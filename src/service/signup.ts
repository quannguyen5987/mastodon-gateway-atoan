import fetch, { HeaderInit } from "node-fetch";
import * as pgpInit from 'pg-promise'; 
import { AES } from 'crypto-js';
import config from "../config";
import { insertMastodonPaave } from "../dao/mastodonPaaveRepository";
import logger from "../logger";
import parse from "node-html-parser";
import { setAccessTokenToRedis } from "../dao/redisRepositories";
import { Constants } from "../Constants";

const pgp = pgpInit({});
const dbConfig = {
	// host : '172.31.245.221',
	host: config.db.mastodon.host,
	port: config.db.mastodon.port,
	database: config.db.mastodon.database,
	user: config.db.mastodon.user,
	password: config.db.mastodon.password,
	max: 200,
};
const db = pgp(dbConfig);

interface IOngoingSignup {
	resolve: (v: any) => void,
	reject: (e: unknown | any) => void,
}

const ongoingSignupMap: { [k: string]: IOngoingSignup[] } = {};

// controller for signup. make sure only signup once
export async function signup(txId: string, userId: string, username: string): Promise<any> {
	let ongoingSignups: IOngoingSignup[] = ongoingSignupMap[username];
	if (ongoingSignups != null) {
		return new Promise((resolve, reject) => {
			ongoingSignups.push({
				resolve,
				reject,
			})
		});
	}
	try {
		const result = await realSignup(txId, userId, username);
		ongoingSignups = ongoingSignupMap[username];
		if (ongoingSignups != null) {
			ongoingSignups.forEach(it => it.resolve(result));
		}
		return result;
	} catch (e: unknown) {
		ongoingSignups = ongoingSignupMap[username];
		if (ongoingSignups != null) {
			ongoingSignups.forEach(it => it.reject(e));
		}
		throw e;
	}
	
}

async function realSignup(txId: string, userId: string, username: string): Promise<any> {
	const email = username.concat('@paave.io');
	const homepageResponse = await fetch(config.rawUrl, {
		"headers": {
			"accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
			"accept-language": "en-US,en;q=0.9",
			"sec-ch-ua": "\"Google Chrome\";v=\"117\", \"Not;A=Brand\";v=\"8\", \"Chromium\";v=\"117\"",
			"sec-ch-ua-mobile": "?0",
			"sec-ch-ua-platform": "\"Windows\"",
			"sec-fetch-dest": "document",
			"sec-fetch-mode": "navigate",
			"sec-fetch-site": "none",
			"sec-fetch-user": "?1",
			"upgrade-insecure-requests": "1"
		},
		"method": "GET"
	});
	// @ts-ignore
	let cookie: string = homepageResponse.headers.get('set-cookie')?.split(';')[0];
	const homepageTextBody: string = await homepageResponse.text();
	let headers: HeaderInit = {
		"accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
		"accept-language": "en-US,en;q=0.9,vi;q=0.8",
		// "if-none-match": "W/\"49811d5a02ac345b4474bd422d2f9630\"",
		"sec-ch-ua": "\"Chromium\";v=\"116\", \"Not)A;Brand\";v=\"24\", \"Google Chrome\";v=\"116\"",
		"sec-ch-ua-mobile": "?0",
		"sec-ch-ua-platform": "\"Windows\"",
		"sec-fetch-dest": "document",
		"sec-fetch-mode": "navigate",
		"sec-fetch-site": "same-origin",
		"sec-fetch-user": "?1",
		"upgrade-insecure-requests": "1",
		// "cookie": "_mastodon_session=AMElWGEYyeulVS3X4O8cW7CXksUR3NXa%2BLnLbeEf4xRkUPdC%2F6BjRc1A2NQpUgNWM1epAs5IaExLWL%2BzQ7dK69qk2KFUmYI61yrvqef826kRUrQpJaSQ0F8xmkEj9M7EJR%2FB%2BYnyb11TbDEhSnY00Y%2Fl0UzQ6h8fHsu%2B2LmbKEEpU7wuKT5pCtqaORiLbigORBwORuwllEfnNt5lrc2IwbUwMWNADcATxV5QOvGz0R32uVwHc5Fl6sQPGuzYEFGuh%2BWpOkFG6g8bytimHBl%2BtrsUVTPfILMgghyzTagRVJRp9Jlc3z4SETi8Sp9rJchXB5QCSOyAo6WusWUO%2F%2FVLz5xYgaoo9Ee9gMll75lmkU2CiSDr9t4l9pn%2Bxx%2BB--OI1X3iZ4JzFWos%2FL--zKigSdFpgznKqbs%2BPQc%2F1w%3D%3D",
		"Referer": config.rawUrl.concat("/auth/sign_in"),
		"Referrer-Policy": "strict-origin-when-cross-origin"
	};
	if (cookie != null) {
		headers.cookie = cookie;
	}
	const signupFormResponse = await fetch(config.rawUrl.concat("/auth/sign_up"), {
		headers: headers,
		method: "GET",
	});
	const cookies = signupFormResponse.headers.get('set-cookie');
	if (cookies != null) {
		const c = cookies.split(';')[0];
		if (c != null && c !== '') {
			cookie = c;
		}
	}
	const signupFormResponseBody = await signupFormResponse.text();
	const root = parse(signupFormResponseBody);
	const authTagString = root.querySelectorAll('input')
	let token: any;
	authTagString.forEach(element => {
		if (element.getAttribute('name') == 'authenticity_token')
			token = element.getAttribute('value');
	});
	let randomPassword = ""
	for (let i = 0; i < 4; i++) {
		randomPassword = randomPassword + String.fromCharCode(Math.floor(Math.random() * 26) + 65);
	}
	for (let i = 0; i < 4; i++) {
		randomPassword = randomPassword + String.fromCharCode(Math.floor(Math.random() * 26) + 97);
	}
	randomPassword = randomPassword + '@';
	for (let i = 0; i < 4; i++) {
		randomPassword = randomPassword + String.fromCharCode(Math.floor(Math.random() * 10) + 48);
	}

	const encryptedPassword = AES.encrypt(Constants.DEFAULT_PASSWORD, randomPassword).toString();

	logger.info("creating account with ", userId, username, encryptedPassword);
	await new Promise((resolve) => {
		setTimeout(resolve, config.signUpDelayInMs);
	});


	const bodySignUp = convertBodySignUp(username, email, randomPassword, token);

	const signupResponse = await fetch(config.rawUrl.concat("/auth"), {
		"headers": {
			"accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
			"accept-language": "en-US,en;q=0.9,vi;q=0.8",
			"cache-control": "max-age=0",
			"content-type": "application/x-www-form-urlencoded",
			"sec-ch-ua": "\"Chromium\";v=\"116\", \"Not)A;Brand\";v=\"24\", \"Google Chrome\";v=\"116\"",
			"sec-ch-ua-mobile": "?0",
			"sec-ch-ua-platform": "\"Windows\"",
			"sec-fetch-dest": "document",
			"sec-fetch-mode": "navigate",
			"sec-fetch-site": "same-origin",
			"sec-fetch-user": "?1",
			"upgrade-insecure-requests": "1",
			// "cookie": "_mastodon_session=WfiDVHS0jFTJFfSPA1Las8XoczPIXaXBWIAwSrBZJKd4GuV2aA%2F1axQYMhS2gLhglx%2BXzWIqMrhEKXHtAZW9LoRy8KFS2WfpDj%2FwE15Fi%2BAyVQ9kpI1Zd98aOf5WR9d5n6LXyX9gT6wRVVSsuxL9lLNGH%2BfQ%2BWckBm3S4lIlob%2FK8CYTK1SdJ7khHktlXBE3H5oTxUEqwp8zPDC5iWsxOA4WMVE5viYy9DSb6Oi5e%2B43uRqrBP9nSqNW8XHE%2Fb9mpld%2BvZny5AN3sIXyYUcicMWW7cSOblsOc%2B85wtnWZ9oe4Tsp3d64R6mKmfRUeCIPwf36nP5kXVdl02PNC83oofQNNncdBxY3gU9dfLL6rZLdudRFpB9MVF1lb1F6--mmBbmYvb5%2FHvX6cf--3r9d8vrvoJ0kibKZqvctpA%3D%3D",
			"cookie": cookie,
			"Referer": config.rawUrl.concat("/auth/sign_up"),
			"Referrer-Policy": "strict-origin-when-cross-origin"
		},
		"body": bodySignUp,
		"method": "POST"
	});
	const dataSignup = await signupResponse.text();
	// return dataSignup.toString();

	// get confirm token in db
	const dataConfirmToken = await getConfirmToken(email)
	const confirmToken = dataConfirmToken?.confirmation_token;
	if (confirmToken == null) {
		logger.error(txId, username, 'Confirm token of is null, signup failed', dataConfirmToken, 
			'\nget cookie==============\n', cookie, homepageResponse.headers.raw(), homepageResponse.status, homepageTextBody, 
			'\nsignup form==============\n', signupFormResponse.status, signupFormResponseBody, 
			"\nsignup response ================\n", signupResponse.status, dataSignup);
		throw new Error("FAIL_TO_CREATE_SOCIAL_ACCOUNT");
	} else {
		logger.info(txId, username, 'getting confirm token is successfully');
		// confirm account via confirm link
		const confirmResponse =
			await fetch(config.rawUrl.concat('/auth/confirmation?confirmation_token=').concat(confirmToken));
		console.log(confirmResponse.status.toString());

		await getAccessTokenFromMastodonDb(userId, username);
		
		logger.warn(txId, "insert new user into database", userId, username);
		await insertMastodonPaave(userId, username, encryptedPassword);
	}
}

function convertBodySignUp(username: string, email: string, password: string, token: string) {
	return 'authenticity_token='.concat(token)
		.concat('&user%5Baccount_attributes%5D%5Bdisplay_name%5D=').concat(username)
		.concat('&user%5Baccount_attributes%5D%5Busername%5D=').concat(username)
		.concat('&user%5Bemail%5D=').concat(email)
		.concat('&user%5Bpassword%5D=').concat(password)
		.concat('&user%5Bpassword_confirmation%5D=').concat(password)
		.concat('&user%5Bconfirm_password%5D=')
		.concat('&user%5Bwebsite%5D=')
		.concat('&accept=')
		.concat('&user%5Binvite_code%5D=')
		.concat('&user%5Bagreement%5D=0')
		.concat('&user%5Bagreement%5D=1')
		.concat('&button=');
}

export async function getAccessTokenFromMastodonDb(userId: string, mastodonUsername: string): Promise<string | undefined> {
	const user: any | null = await db.oneOrNone('select a.username, oat.token, oat.created_at ' +
		'from users u inner join oauth_access_tokens oat on u.id = oat.resource_owner_id ' +
		'inner join public.accounts a on a.id = u.account_id ' +
		'where a.username = $1' +
		' order by oat.created_at desc limit 1', mastodonUsername);
	if (user != null && user['token'] != null) {
		return setAccessTokenToRedis(userId, user['token']);
	}
	return undefined;
}


function getConfirmToken(email: string) {
	return db.oneOrNone('select confirmation_token from users where email = $1', email);
}

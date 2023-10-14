import { parse } from "node-html-parser";
import fetch from "node-fetch"
import { AES } from 'crypto-js';
import config from "../config";
import logger from "../logger";
import { Constants } from "../Constants";
import { checkUserPaaveExist } from "../dao/mastodonPaaveRepository";

export async function login(txId: string | undefined, userId: string, username: string, user: any | undefined): Promise<string> {
	let dbUser = user || await checkUserPaaveExist(userId);
	const email = username.concat('@paave.io');
	const response = await fetch(config.rawUrl.concat("/auth/sign_in"), {
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
	const data = await response.text();
	const cookieQuerySignIn: any = response.headers.get('Set-Cookie')?.split(';')[0];

	// console.log('cookie signin GET: '+cookieQuerySignIn)
	const root = parse(data);
	const authenTagString = root.querySelectorAll('input')
	var token: any;
	authenTagString.forEach(element => {
		if (element.getAttribute('name') == 'authenticity_token')
			token = element.getAttribute('value');
	});

	logger.info(txId, 'token:', token, 'cookie:', cookieQuerySignIn);

	const loginResponse = await fetch(config.rawUrl.concat("/auth/sign_in"), {
		"headers": {
			"accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
			"accept-language": "en-US,en;q=0.9",
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
			"cookie": cookieQuerySignIn,
			"Referer": config.rawUrl.concat("/auth/sign_in"),
			"Referrer-Policy": "strict-origin-when-cross-origin"
		},
		"body": convertBodyLogin(email, AES.decrypt(token, Constants.DEFAULT_PASSWORD, dbUser.password).toString(), token),
		"method": "POST",
		"redirect": "manual"
	});

	const loginData = await loginResponse.text();
	const cookieQuerySignInPost: any = loginResponse.headers.get('Set-Cookie');
	// console.log('cookie signin POST: '+cookieQuerySignInPost)
	// return loginData.toString();
	const redirectPageResponse = await fetch(config.rawUrl, {
		"headers": {
			"accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
			"accept-language": "en-US,en;q=0.9",
			"cache-control": "max-age=0",
			"if-none-match": "W/\"913ae16acd10df1ab9271aa195fe5ab9\"",
			"sec-ch-ua": "\"Chromium\";v=\"116\", \"Not)A;Brand\";v=\"24\", \"Google Chrome\";v=\"116\"",
			"sec-ch-ua-mobile": "?0",
			"sec-ch-ua-platform": "\"Windows\"",
			"sec-fetch-dest": "document",
			"sec-fetch-mode": "navigate",
			"sec-fetch-site": "same-origin",
			"sec-fetch-user": "?1",
			"upgrade-insecure-requests": "1",
			"cookie": cookieQuerySignInPost,
			"Referer": config.rawUrl.concat("/auth/sign_in"),
			"Referrer-Policy": "strict-origin-when-cross-origin"
		},
		"method": "GET"
	});
	const redirectPageData = await redirectPageResponse.text();
	const rootRedirect = parse(redirectPageData);
	const authenTagStringRedirect = rootRedirect.getElementById('initial-state').textContent;
	const jsonInitialState = JSON.parse(authenTagStringRedirect);
	logger.info(txId, "jsonInitialState: ", jsonInitialState);
	const accessToken = jsonInitialState['meta']['access_token'];
	return accessToken;
}

function convertBodyLogin(email: string, password: string, token: string): string {
	return 'authenticity_token='.concat(token)
		.concat('&user%5Bemail%5D=').concat(email)
		.concat('&user%5Bpassword%5D=').concat(password)
		.concat('&button=');
}

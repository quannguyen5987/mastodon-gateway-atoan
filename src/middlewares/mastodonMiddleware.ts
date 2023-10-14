import { Request, Response, NextFunction } from 'express';
import {
	verify,
	VerifyOptions,
	VerifyErrors,
	Jwt,
} from 'jsonwebtoken';
import fetch, { Headers, RequestInit } from "node-fetch"
import PaaveToken from "../dao/PaaveToken";
import config, { INeedGrant } from "../config";
import logger from "../logger";
import { checkUserPaaveExist, checkAccessGrant } from '../dao/mastodonPaaveRepository';
import { login } from '../service/login';
import { getAccessTokenFromMastodonDb, signup } from '../service/signup';
import { getAccessTokenFromRedis, getUsernameFromRedis, setAccessTokenToRedis, setUsernameToRedis } from '../dao/redisRepositories';

const apiNeedGrants: INeedGrant[] | null | undefined = config.needGrant;

export function mastodonMiddleware(req: Request, res: Response, next: NextFunction) {
	realMastodonMiddleware(req, res, next).then().catch(e => {
		logger.error("fail to handle request ", req.headers.rid, e);
		respond(res, 500, 'INTERNAL_SERVER_ERROR');
	});
	return null;
}

function respond(res: Response, status: number, code: string, messageParams: string[] | undefined = undefined) {
	res.status(status).send(JSON.stringify({ code, messageParams }));
}

export async function realMastodonMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
	let txId = req.headers.rid;
	if (Array.isArray(txId)) {
		txId = (txId as string[]).find(s => s != null && s !== "");
	}
	if (txId == null) {
		txId = new Date().getTime().toString();
	}

	logger.info(txId, 'Client headers: ', req.headers);
	let paaveTokenString = req.headers.authorization;
	if (!paaveTokenString) {
		respond(res, 401, 'UNAUTHORIZED');
		return;
	}
	paaveTokenString = paaveTokenString.toString().split(' ')[1];
	let paaveToken: PaaveToken;
	try {
	  paaveToken = await jwtVerify(paaveTokenString, config.jwt.publicKey, {
			algorithms: ['RS256'],
			complete: true,
		}).then((jwt: Jwt) => jwt.payload as PaaveToken);
	} catch(e: any) {
		logger.error(txId, 'fail to verify token', e.message);
		respond(res, 401, "UNAUTHORIZED");
		return;
	}
	let username = paaveToken.ud.username;
	let userId = `${paaveToken.ud.id}` || username;
	username = username.replace(/\./g, '_');
	logger.info(txId, 'username: ', username, 'userId:', userId);

	const url = req.url;
	if (apiNeedGrants != null && apiNeedGrants.length > 0 && apiNeedGrants.find((api: INeedGrant) => {
		return api.method == req.method && ((typeof api.uri === 'string') ? api.uri == url : url.match(api.uri as RegExp) != null)
	}) != null) {
		const accessGrant = await checkAccessGrant(userId);
		if (!accessGrant) {
			respond(res, 403, 'FORBIDDEN');
			return;
		}
	}
	let user: any | undefined = undefined;
	try {
		let mastodonAccessToken: string | undefined = undefined;
		mastodonAccessToken = await getAccessTokenFromRedis(userId);
		if (mastodonAccessToken == null) {
			let mastodonUsername: string;
			const mastodonUsernameFromRedis = await getUsernameFromRedis(userId);
			if (mastodonUsernameFromRedis == null) {
				user = await checkUserPaaveExist(userId);
				if (user == null) {
					mastodonUsername = username;
					logger.warn(txId, "signing up user", userId, mastodonUsername);
					await signup(txId, userId, mastodonUsername);
				} else {
					logger.info(txId, 'user data: ', user);
					mastodonUsername = user.username;
				}
				await setUsernameToRedis(userId, mastodonUsername);
			} else {
				mastodonUsername = mastodonUsernameFromRedis;
			}

			if (mastodonAccessToken == null) {
				logger.warn(txId, "no access token found re-login");
				mastodonAccessToken = await login(txId, userId, mastodonUsername, user);
				if (mastodonAccessToken != null) {
					await setAccessTokenToRedis(userId, mastodonAccessToken);
				} else {
					logger.warn(txId, "fail to login for username", userId, mastodonUsername);
				}
			}
			if (mastodonAccessToken == null) {
				logger.warn(txId, "no access token found get from mastodon database");
				mastodonAccessToken = await getAccessTokenFromMastodonDb(userId, mastodonUsername);
			}
			if (mastodonAccessToken == null) {
				respond(res, 500, 'FAIL_TO_GET_ACCESS_TOKEN');
				return;
			}
		}
		const url = config.url.concat(req.url);
		const data = await callMastodonService(txId, url, req, mastodonAccessToken);
		res.status(200).json(data);
	} catch (error) {
		logger.error(error);
		respond(res, 500, 'INTERNAL_SERVER_ERROR');
	}
}

async function callMastodonService(txId: string, url: string, req: Request, mastodonAccessToken: any): Promise<any> {
	const bearerString = 'Bearer '.concat(mastodonAccessToken);
	let headers = new Headers();
	Object.keys(req.headers).forEach(key => {
		if (key === 'user-agent' || key === 'authorization' || key === 'content-type' || key === 'host') {
			return;
		}
		const value = req.headers[key];
		if (value == null) {
			return;
		}
		if (Array.isArray(value)) {
			(value as string[]).forEach(it => headers.append(key, it));
		} else {
			headers.append(key, value);
		}
	});
	headers.append('Authorization', bearerString);
	headers.append('Content-Type', 'application/json');
	headers.append('Host', config.replacingHost);

	const requestInit: RequestInit = {
		method: req.method,
		headers,
	};

	if (req.method != 'GET') {
		requestInit.body = JSON.stringify(req.body);
	}
	logger.info(txId, 'calling mastodon: ', url, headers.raw(), requestInit.body);
	const response = await fetch(url, requestInit);
	const textData = await response.text();
	logger.info(txId, 'response status: ', response.status.toString(), 'and body', textData);
	try {
		const data = JSON.parse(textData);
		return data;
	} catch (e) {
		logger.error(txId, 'fail to parse body json data', e);
		throw e;
	}
}

export const jwtVerify = (
	token: string,
	secretOrPublicKey: string | Buffer,
	options: VerifyOptions & {complete: true}
) => {
	return new Promise(
		(resolve: (payload: any) => void, reject: (err: Error) => void) => {
			// tslint:disable-line
			verify(
				token,
				secretOrPublicKey,
				options,
				(err: VerifyErrors | null, decoded: Jwt | undefined) => {
					if (err != null) {
						reject(err);
					} else {
						resolve(decoded);
					}
				}
			);
		}
	);
};

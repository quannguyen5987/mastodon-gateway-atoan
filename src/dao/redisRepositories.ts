import { createClient } from "redis";
import config from "../config";
import { Constants } from "../Constants";

const redisClient = createClient({ url: `redis://@${config.redis.host}:${config.redis.port}` });
redisClient.connect();



export async function setAccessTokenToRedis(userId: string, mastodonAccessToken: string): Promise<string> {
	await redisClient.hSet(Constants.REDIS_ACCESS_TOKEN_KEY, userId, mastodonAccessToken);
	return mastodonAccessToken;
}

export async function getAccessTokenFromRedis(userId: string): Promise<string | undefined> {
	return redisClient.hGet(Constants.REDIS_ACCESS_TOKEN_KEY, userId);
}

export async function getUsernameFromRedis(userId: string): Promise<string | undefined> {
	return redisClient.hGet(Constants.REDIS_USER_MAP, userId);
}

export async function setUsernameToRedis(userId: string, mastodonUsername: string): Promise<string> {
	await redisClient.hSet(Constants.REDIS_USER_MAP, userId, mastodonUsername);
	return mastodonUsername;
}

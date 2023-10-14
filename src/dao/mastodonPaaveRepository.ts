import config from "../config";
import * as pgpInit from 'pg-promise';

const pgp = pgpInit({});
const dbGatewayConfig = {
	host: config.db.mastodon_paave.host,
	port: config.db.mastodon_paave.port,
	database: config.db.mastodon_paave.database,
	user: config.db.mastodon_paave.user,
	password: config.db.mastodon_paave.password,
	max: 200,
};
const dbGateway = pgp(dbGatewayConfig);

export async function checkUserPaaveExist(userId: string): Promise<any | null> {
	const result = await dbGateway.query('SELECT * FROM users WHERE user_id = $1', [userId]);
	if (result.length > 0) {
		return result[0];
	}
	return null;
}

export async function insertMastodonPaave(userId: string, username: string, encryptedPassword: string): Promise<any> {
	return dbGateway.query('INSERT INTO users (user_id, username, password) VALUES ($1, $2, $3)', [userId, username, encryptedPassword]);
}

export async function checkAccessGrant(userId: string): Promise<boolean> {
	const result = await dbGateway.query('select user_id from t_users_grant where user_id = $1', [userId]);
	return result?.length > 0
}

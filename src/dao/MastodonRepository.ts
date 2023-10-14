import config from "../config";

const pgpMastodon = require('pg-promise')({});
const dbMastodonConfig = {
    host: config.db.mastodon.host,
    port : config.db.mastodon.port,
    database : config.db.mastodon.database,
    user : config.db.mastodon.user,
    password : config.db.mastodon.password,
    max : 200,
};
const dbMastodon = pgpMastodon(dbMastodonConfig);

async function checkUserExist(username: string): Promise<boolean> {
    const result = await dbMastodon.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.length > 0) {
        return true;
    }
    return false;
}

async function getConfirmToken(email: string) {
    return await dbMastodon.oneOrNone('select confirmation_token from users where email = $1', email);
}

module.exports =  {
    checkUserExist
};

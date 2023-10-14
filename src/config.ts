import * as fs from "fs";
import logger from "./logger";

export interface INeedGrant {
	method: string;
	uri: string | RegExp;
}

export interface IDb {
	host: string;
	port: number;
	database: string;
	user: string;
	password: string;
}

export interface IConfig {
	port: number;
	rawUrl: string;
	url: string;
	replacingHost: string;
	signUpDelayInMs: number;
	db: {
		mastodon: IDb;
		mastodon_paave: IDb;
	},
	redis: {
		host: string;
		port: number;
	},
	needGrant?: INeedGrant[],
	jwt: {
		publicKey: string;
		publicKeyFile: string;
	},
}

let config: IConfig = {
	port: 7000,
	rawUrl: "https://social-uat.paave.io",
	// url: "https://social-uat.paave.io",
	url: "http://localhost:3001",
	replacingHost: "social-uat.paave.io",
	signUpDelayInMs: 3000,
	db: {
		mastodon: {
			host: "172.31.245.221",
			port: 5432,
			database: "mastodon",
			user: "mastodon",
			password: "Abc@123456"
		},
		mastodon_paave: {
			host: "172.31.245.221",
			port: 5432,
			database: "mastodon_paave",
			user: "mastodon",
			password: "Abc@123456"
		},
	},
	redis: {
		host: "172.31.245.221",
		port: 6379,
	},
	needGrant: [
		{
			method: "POST", 
			uri: "/api/v1/statuses"
		},
		{
			method: "PUT",
			uri: /^\/api\/v1\/statuses\/.+$/,
		},
		{
			method: "DELETE",
			uri: /^\/api\/v1\/statuses\/.+$/,
		}
	],
	jwt: {
		publicKey: '',
		publicKeyFile: '',
	},
}

if (fs.existsSync("env.js")) {
	try {
		const configFileStr = fs.readFileSync("env.js", "utf8");
		const vm = require("node:vm");
		const script = new vm.Script(configFileStr);
		script.runInNewContext({
			conf: config,
			config: config,
			process,
		});
	} catch (e) {
		logger.error("fail to load external configuration", e);
	}
}
if (fs.existsSync("env.json")) {
	try {
		let externalConfigContent = fs.readFileSync("env.json", "utf-8");
		let externalConfig = JSON.parse(externalConfigContent);
		config.url = externalConfig.url;
		config.db.mastodon.host = externalConfig.db.mastodon.host;
		config.db.mastodon.port = externalConfig.db.mastodon.port;
		config.db.mastodon.database = externalConfig.db.mastodon.database;
		config.db.mastodon.user = externalConfig.db.mastodon.user;
		config.db.mastodon.password = externalConfig.db.mastodon.password;
		config.db.mastodon_paave.host = externalConfig.db.mastodon_paave.host;
		config.db.mastodon_paave.port = externalConfig.db.mastodon_paave.port;
		config.db.mastodon_paave.database = externalConfig.db.mastodon_paave.database;
		config.db.mastodon_paave.user = externalConfig.db.mastodon_paave.user;
		config.db.mastodon_paave.password = externalConfig.db.mastodon_paave.password;
		config.redis.host = externalConfig.db.redis.host;
		config.redis.port = externalConfig.db.redis.port;
	} catch (error) {
		logger.info("fail to load external configuration");
	}
}
logger.info('configuration: ', JSON.stringify(config));

config.jwt.publicKey = fs.readFileSync(config.jwt.publicKeyFile, 'utf8');

export default config;

// import log4js from "log4js";

const log4js = require("log4js");

log4js.configure({
    "appenders": {
        "application": {
            "type": "console"
        },
        "file": {
            "type": "file",
            "filename": "/logs/application.log",
            "compression": true,
            "maxLogSize": 10485760,
            "backups": 100
        }
    },
    "categories": {
        "default": {
            "appenders": [
                "application",
                "file"
            ],
            "level": "info"
        }
    }
});
const logger = log4js.getLogger();
export default logger;

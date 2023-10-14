import app from "./app";
import config from "./config";
import logger from "./logger";
const PORT = config.port;

app.listen(PORT, () => {
    logger.info(`Server is running on port: ${PORT}`);
});

import * as express from "express";
import * as bodyParser from "body-parser";
import { mastodonRouter } from "./routes/mastodonRouter";
import { mastodonMiddleware } from "./middlewares/mastodonMiddleware";

class App {

    public app: express.Application;

    constructor() {
        this.app = express();
        this.config();        
    }

    private config(): void{
        this.app.use(express.json());
        this.app.use(bodyParser.urlencoded({ extended: false }));
        this.app.use('/', mastodonMiddleware, mastodonRouter);
        this.app.get('/api/v1/user/social/access', ddd, mastodonRouter);

    }
}

export default new App().app;

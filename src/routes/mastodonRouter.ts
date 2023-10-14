import * as express from "express";
import { Request, Response } from 'express';

export const mastodonRouter = express.Router();

mastodonRouter.all('/*', async (req: Request, res: Response) => {});

import {Request, Response} from 'express';
import PromiseRouter from "express-promise-router";

const router = PromiseRouter();


function healthCheck(req: Request, res: Response) {
    res.send('ok');
}

router.get('/health', healthCheck);

export default router;

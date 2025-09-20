import {Request, Response} from 'express';
import PromiseRouter from "express-promise-router";

const router = PromiseRouter();


function healthCheck(req: Request, res: Response) {
    res.send('ok');
}

router.get('/health', healthCheck);
// Add this right after the existing healthCheck route
router.get('/', (_req: Request, res: Response) => {
    res.json({
        message: 'Welcome to Opsimate server',
        status: 'Server is up and running',
        timestamp: new Date().toISOString()
    });
});

export default router;

import { Request, Response, Router } from "express";

const router = Router();

router.get('/health', (req: Request, res: Response) => {
    res.send('ok');
});

export default router;
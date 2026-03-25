import { Router } from 'express';
import userController from '../controller/user-controller.js';
import { authMiddleware } from '../middleware/auth-middleware.js';

const authRouter = Router();

authRouter.post('/register', userController.register);
authRouter.post('/login', userController.login);
authRouter.delete('/logout', userController.logout);
authRouter.get('/token', userController.refresh);
authRouter.get('/user/get', authMiddleware, userController.get);

authRouter.put('/profile', authMiddleware, userController.update);

export { authRouter };

import express from "express";
import userController from "../controller/user-controller.js";
import {authMiddleware} from "../middleware/auth-middleware.js";
import tmstUserController from "../controller/tmst-user-controller.js";

const userRouter = new express.Router();

userRouter.use(authMiddleware);

// User API
userRouter.get('/api/users/current', userController.get);
userRouter.patch('/api/users/current', userController.update);
userRouter.delete('/api/users/logout', userController.logout);
userRouter.get('/api/users/me', tmstUserController.getMy);

export {
    userRouter
}

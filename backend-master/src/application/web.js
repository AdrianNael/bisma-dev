import express from "express";
import { publicRouter } from "../route/public-api.js";
import { errorMiddleware } from "../middleware/error-middleware.js";
import { authMiddleware } from "../middleware/auth-middleware.js";
import { userRouter } from "../route/api.js";
import { authRouter } from "../route/auth-route.js";
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const apiDocumentation = require('../../docs/apidocs.json');
import swaggerUi from "swagger-ui-express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cookieParser from 'cookie-parser';
import fileUpload from 'express-fileupload';


dotenv.config();
export const web = express();

// CORS configuration
const corsOptions = {
  origin: ['https://bismadev.universitaspertamina.ac.id', 'http://localhost:3003'], 
  credentials: true, 
};

// SWAGGER
web.use("/api-docs", swaggerUi.serve, swaggerUi.setup(apiDocumentation));


web.use(cors(corsOptions)); 
web.use(fileUpload());
web.use(helmet());
web.use(express.urlencoded({ extended: true }));
web.use(bodyParser.json());
web.use(express.json());
web.set("view engine", "ejs");
web.use("/public/", express.static("./public"));
web.use(cookieParser());

web.use(authRouter);
web.use(authMiddleware);
web.use(publicRouter);


web.use(userRouter);

web.use(errorMiddleware);

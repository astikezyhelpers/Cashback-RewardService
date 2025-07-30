import express from 'express';
import cookieParser from "cookie-parser";
import { errorHandler } from './middleware/errorHandler.middleware.js';

const app = express();

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"))
app.use(cookieParser())

import rewardRouter from "./routes/reward.route.js";
import cashBackRouter from "./routes/cashback.route.js"
import loyaltyRouter from "./routes/loyalty.route.js"

app.use("/api/v1/rewards", rewardRouter);
app.use("/api/v1/cashback", cashBackRouter);
app.use("/api/v1/loyalty", loyaltyRouter);

app.use(errorHandler);

export { app };
import express from 'express';
import cookieParser from "cookie-parser";
import { errorHandler } from './middleware/errorHandler.middleware.js';
import rateLimit  from 'express-rate-limit';
import { ApiError } from './utils/ApiError.js';

const app = express();

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute in milliseconds
  max: 10, // Max 10 requests per 1-minute window
  handler: (req,res,next) => {
    next(new ApiError(429, "TO_MANY_REQUEST","To many request, please try again later."));
  },
});

import rewardRouter from "./routes/reward.route.js";
import cashBackRouter from "./routes/cashback.route.js"
import loyaltyRouter from "./routes/loyalty.route.js"

app.use("/api/v1/rewards",limiter, rewardRouter);
app.use("/api/v1/cashback",limiter, cashBackRouter);
app.use("/api/v1/loyalty",limiter, loyaltyRouter);

app.use(errorHandler);

export { app };
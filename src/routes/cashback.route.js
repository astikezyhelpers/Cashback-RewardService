import express from "express";
import { calculateCashback, getCashbackHistory, getCashbackTransactions } from "../controller/cashback.controller.js";

const router = express.Router();

router.post("/calculate", calculateCashback);
router.get("/:userId/summary", getCashbackHistory);
router.get("/:userId/transactions", getCashbackTransactions);

export default router;
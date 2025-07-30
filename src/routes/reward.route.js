import express from "express";
import { getRewardsHistory, getRewardsSummary, redeemPoints } from "../controller/reward.controller.js";

const router = express.Router();

router.get("/:userId", getRewardsSummary);
router.post("/redeem", redeemPoints);
router.get("/:userId/history", getRewardsHistory);

export default router;
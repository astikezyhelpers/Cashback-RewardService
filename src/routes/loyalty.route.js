import express from "express";
import { getLoyaltyPrograms, getLoyaltyStatus, upgradeLoyaltyTier } from "../controller/loyalty.controller.js";

const router = express.Router();

router.get("/programs",getLoyaltyPrograms);
router.get("/:userId/status",getLoyaltyStatus);
router.put("/:userId/upgrade",upgradeLoyaltyTier);

export default router;
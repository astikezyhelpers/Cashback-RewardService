import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import prisma from "../lib/prisma.js";

const getRewardsSummary = asyncHandler(async(req,res) => {
    try {
        const { userId } = req.params;
        const userIdToUse = userId || req.user.id;

        // Get reward points summary
        const rewardPoints = await prisma.rewardPoints.groupBy({
            by: ['user_id'],
            where: {
                user_id: userIdToUse
            },
            _sum: {
                points_earned: true,
                points_available: true,
                points_redeemed: true,
                points_expired: true
            }
        });

        // Get loyalty status
        const loyaltyStatus = await prisma.userLoyaltyStatus.findFirst({
            where: {
                user_id: userIdToUse
            },
            include: {
                loyaltyProgram: true
            }
        });

        // Count expiring points (within 30 days)
        const expiringSoon = await prisma.rewardPoints.count({
            where: {
                user_id: userIdToUse,
                expiry_date: {
                    lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
                }
            }
        });

        const summary = {
            userId: userIdToUse,
            points: {
                totalEarned: rewardPoints[0]?._sum.points_earned || 0,
                available: rewardPoints[0]?._sum.points_available || 0,
                totalRedeemed: rewardPoints[0]?._sum.points_redeemed || 0,
                expired: rewardPoints[0]?._sum.points_expired || 0,
                expiringSoon: expiringSoon
            },
            loyaltyStatus: loyaltyStatus ? {
                currentTier: loyaltyStatus.current_tier,
                tierProgress: loyaltyStatus.tier_progress,
                tierExpiryDate: loyaltyStatus.tier_expiry_date,
                programName: loyaltyStatus.loyaltyProgram?.name
            } : null
        };

        return res.status(200).json(new ApiResponse(200, summary));

    } catch (error) {
        console.error('Error fetching rewards summary:', error);
        throw new ApiError(500,"Internal server error while getting reward summary", error.message);
    }
})

const redeemPoints = asyncHandler(async(req,res) => {
    try {
        const { userId, pointsToRedeem, redemptionType, redemptionDetails } = req.body;
        const userIdToUse = userId || req.user.id;

        // Validation
        if (!pointsToRedeem || !redemptionType) {
            throw new ApiError(400,"Missing required fields: pointsToRedeem, redemptionType", "VALIDATION_ERROR")
        }

        // Start transaction
        const result = await prisma.$transaction(async (tx) => {
            // Check available points
            const totalPoints = await tx.rewardPoints.aggregate({
                where: {
                    user_id: userIdToUse
                },
                _sum: {
                    points_available: true
                }
            });

            const availablePoints = totalPoints._sum.points_available || 0;

            if (availablePoints < pointsToRedeem) {
                throw new Error(`Insufficient points. Available: ${availablePoints}, Requested: ${pointsToRedeem}`);
            }

            // Calculate cash value (100 points = $1)
            const cashValue = pointsToRedeem / 100;

            // Create redemption record
            const redemption = await tx.rewardRedemptions.create({
                data: {
                    user_id: userIdToUse,
                    points_used: pointsToRedeem,
                    redemption_type: redemptionType,
                    redemption_details: redemptionDetails || {},
                    cash_value: cashValue,
                    status: 'COMPLETED',
                    processed_at: new Date(),
                    created_at: new Date()
                }
            });

            // Update points (FIFO - oldest points first)
            const pointsToUpdate = await tx.rewardPoints.findMany({
                where: {
                    user_id: userIdToUse,
                    points_available: {
                        gt: 0
                    }
                },
                orderBy: {
                    created_at: 'asc'
                }
            });

            let remainingToRedeem = pointsToRedeem;
            
            for (const pointRecord of pointsToUpdate) {
                if (remainingToRedeem <= 0) break;

                const availableInRecord = pointRecord.points_available;
                const toDeduct = Math.min(availableInRecord, remainingToRedeem);

                await tx.rewardPoints.update({
                    where: { id: pointRecord.id },
                    data: {
                        points_available: availableInRecord - toDeduct,
                        points_redeemed: pointRecord.points_redeemed + toDeduct
                    }
                });

                remainingToRedeem -= toDeduct;
            }

            // Add to reward history
            await tx.rewardHistory.create({
                data: {
                    user_id: userIdToUse,
                    action_type: 'POINTS_REDEEMED',
                    points_change: -pointsToRedeem,
                    cashback_change: 0,
                    description: `Points redeemed for ${redemptionType}`,
                    metadata: {
                        redemption_id: redemption.id,
                        ...redemptionDetails
                    },
                    created_at: new Date()
                }
            });

            return redemption;
        });

        return res.status(201).json(new ApiResponse(201,{
            redemptionId: result.id,
            status: 'success',
            pointsRedeemed: pointsToRedeem,
            cashValue: result.cash_value,
            redemptionType,
            processedAt: result.processed_at
        }))

    } catch (error) {
        console.error('Error processing redemption:', error);
        throw new ApiError(500, "Failed to process redemption", error.message);
    }
})

const getRewardsHistory = asyncHandler(async(req,res) => {
    try {
        const { userId } = req.params;
        const userIdToUse = userId || req.user.id;
        const { 
            page = 1, 
            limit = 20, 
            action_type,
            start_date,
            end_date 
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Build where clause
        const whereClause = {
            user_id: userIdToUse
        };

        if (action_type) {
            whereClause.action_type = action_type;
        }

        if (start_date && end_date) {
            whereClause.created_at = {
                gte: new Date(start_date),
                lte: new Date(end_date)
            };
        }

        // Get transactions with count
        const [transactions, totalCount] = await Promise.all([
            prisma.rewardHistory.findMany({
                where: whereClause,
                orderBy: {
                    created_at: 'desc'
                },
                skip: skip,
                take: parseInt(limit),
                include: {
                    // You can include related data if needed
                }
            }),
            prisma.rewardHistory.count({
                where: whereClause
            })
        ]);

        const totalPages = Math.ceil(totalCount / parseInt(limit));

        return res.status(200).json(new ApiResponse(200,{
            transactions: transactions.map(t => ({
                id: t.id,
                actionType: t.action_type,
                pointsChange: t.points_change,
                cashbackChange: t.cashback_change,
                description: t.description,
                metadata: t.metadata,
                createdAt: t.created_at
            })),
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalRecords: totalCount,
                hasNextPage: parseInt(page) < totalPages,
                hasPreviousPage: parseInt(page) > 1,
                limit: parseInt(limit)
            }
        }));

    } catch (error) {
        console.error('Error fetching reward history:', error);
        throw new ApiError(500, "Internal server error",error.message)
    }
})

export {getRewardsSummary, redeemPoints, getRewardsHistory};
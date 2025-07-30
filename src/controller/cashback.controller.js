import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import prisma from "../lib/prisma.js";

const calculateCashback = asyncHandler(async (req, res) => {
    try {
        const { userId, transactionAmount, transactionId, category } = req.body;
        const userIdToUse = userId || req.user.id;

        if (!transactionAmount) {
            throw new ApiError(400, "Missing required field: transactionAmount", "VALIDATION_ERROR")
        }

        // Get user's loyalty status
        const userStatus = await prisma.userLoyaltyStatus.findFirst({
            where: {
                user_id: userIdToUse,
                loyaltyProgram: {
                    is_active: true
                }
            },
            include: {
                loyaltyProgram: true
            }
        });

        if (!userStatus || !userStatus.loyaltyProgram) {
            throw new ApiError(404, "User not enrolled in any active loyalty program")
        }

        const { current_tier, loyaltyProgram } = userStatus;

        // Get base cashback rate from tier benefits
        let baseCashbackRate = 0.05; // Default 5%
        const tierBenefits = loyaltyProgram.benefits[current_tier];

        if (tierBenefits) {
            const cashbackBenefit = tierBenefits.find(b => b.includes('cashback'));
            if (cashbackBenefit) {
                const match = cashbackBenefit.match(/(\d+)%/);
                if (match) {
                    baseCashbackRate = parseInt(match[1]) / 100;
                }
            }
        }

        // Get active campaigns
        const campaigns = await prisma.campaigns.findMany({
            where: {
                is_active: true,
                start_date: {
                    lte: new Date()
                },
                end_date: {
                    gte: new Date()
                },
                OR: [
                    { min_transaction: null },
                    { min_transaction: { lte: transactionAmount } }
                ]
            },
            include: {
                userCampaigns: {
                    where: {
                        user_id: userIdToUse
                    }
                }
            }
        });

        let finalCashbackRate = baseCashbackRate;
        let applicableCampaign = null;

        // Find best applicable campaign
        for (const campaign of campaigns) {
            const rules = campaign.rules;
            const rewards = campaign.rewards;

            // Check if campaign applies to category
            if (!rules.category || rules.category === 'all' || rules.category === category) {
                const campaignRate = rewards.cashback_rate || baseCashbackRate;
                const multiplier = rules.multiplier || 1;
                const effectiveRate = campaignRate * multiplier;

                // Check campaign limits
                const userCampaign = campaign.userCampaigns[0];
                const userEarned = userCampaign?.total_earned || 0;
                const maxCashback = campaign.max_cashback;

                if (!maxCashback || userEarned < maxCashback) {
                    if (effectiveRate > finalCashbackRate) {
                        finalCashbackRate = effectiveRate;
                        applicableCampaign = campaign;
                    }
                }
            }
        }

        const cashbackAmount = transactionAmount * finalCashbackRate;
        let cappedCashbackAmount = cashbackAmount;

        // Apply campaign cap if applicable
        if (applicableCampaign?.max_cashback) {
            const userCampaign = applicableCampaign.userCampaigns[0];
            const userEarned = userCampaign?.total_earned || 0;
            const remainingCap = applicableCampaign.max_cashback - userEarned;
            cappedCashbackAmount = Math.min(cashbackAmount, remainingCap);
        }

        return res.status(200).json(new ApiResponse(200, {
            userId: userIdToUse,
            transactionId,
            transactionAmount: parseFloat(transactionAmount),
            cashback: {
                rate: finalCashbackRate,
                amount: parseFloat(cappedCashbackAmount.toFixed(2)),
                tier: current_tier,
                campaignId: applicableCampaign?.id || null,
                campaignName: applicableCampaign?.name || null
            },
            calculation: {
                baseTierRate: baseCashbackRate,
                finalRate: finalCashbackRate,
                rawAmount: parseFloat(cashbackAmount.toFixed(2)),
                cappedAmount: parseFloat(cappedCashbackAmount.toFixed(2))
            }
        }));

    } catch (error) {
        console.error('Error calculating cashback:', error);
        // res.status(500).json({ error: 'Failed to calculate cashback', details: error.message });
        throw new ApiError(500, "Failed to calculate cashback", error.message);
    }
})

const getCashbackHistory = asyncHandler (async (req,res) => {
    try {
        const { userId } = req.params;
        const userIdToUse = userId || req.user.id;

        // Get cashback summary
        const cashbackSummary = await prisma.cashbackTransactions.aggregate({
            where: {
                user_id: userIdToUse
            },
            _count: {
                id: true
            },
            _sum: {
                cashback_amount: true
            },
            _avg: {
                cashback_percentage: true
            }
        });

        // Get status breakdown
        const statusBreakdown = await prisma.cashbackTransactions.groupBy({
            by: ['status'],
            where: {
                user_id: userIdToUse
            },
            _sum: {
                cashback_amount: true
            }
        });

        // Get current month cashback
        const currentMonthStart = new Date();
        currentMonthStart.setDate(1);
        currentMonthStart.setHours(0, 0, 0, 0);

        const currentMonthCashback = await prisma.cashbackTransactions.aggregate({
            where: {
                user_id: userIdToUse,
                created_at: {
                    gte: currentMonthStart
                }
            },
            _sum: {
                cashback_amount: true
            }
        });

        // Get campaigns used
        const campaignsUsed = await prisma.cashbackTransactions.findMany({
            where: {
                user_id: userIdToUse,
                campaign_id: {
                    not: null
                }
            },
            distinct: ['campaign_id'],
            select: {
                campaign_id: true
            }
        });

        // Get last cashback date
        const lastCashback = await prisma.cashbackTransactions.findFirst({
            where: {
                user_id: userIdToUse
            },
            orderBy: {
                created_at: 'desc'
            },
            select: {
                created_at: true
            }
        });

        const summary = {
            userId: userIdToUse,
            summary: {
                totalTransactions: cashbackSummary._count.id || 0,
                totalEarned: cashbackSummary._sum.cashback_amount || 0,
                received: statusBreakdown.find(s => s.status === 'COMPLETED')?._sum.cashback_amount || 0,
                pending: statusBreakdown.find(s => s.status === 'PENDING')?._sum.cashback_amount || 0,
                averageRate: cashbackSummary._avg.cashback_percentage || 0,
                currentMonthEarned: currentMonthCashback._sum.cashback_amount || 0,
                campaignsUsed: campaignsUsed.length,
                lastCashbackDate: lastCashback?.created_at || null
            }
        };

        return res.status(200).json(new ApiResponse(200, summary));

    } catch (error) {
        console.error('Error fetching cashback summary:', error);
        throw new ApiError(500,"Internal server error while getting cashback history", error.message);
        // res.status(500).json({ error: 'Internal server error', details: error.message });
    }
})

const getCashbackTransactions = asyncHandler (async (req,res) => {
    try {
        const { userId } = req.params;
        const userIdToUse = userId || req.user.id;
        const { 
            page = 1, 
            limit = 20, 
            status, 
            campaign_id,
            start_date,
            end_date 
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Build where clause
        const whereClause = {
            user_id: userIdToUse
        };

        if (status) {
            whereClause.status = status;
        }

        if (campaign_id) {
            whereClause.campaign_id = campaign_id;
        }

        if (start_date && end_date) {
            whereClause.created_at = {
                gte: new Date(start_date),
                lte: new Date(end_date)
            };
        }

        // Get transactions with count
        const [transactions, totalCount] = await Promise.all([
            prisma.cashbackTransactions.findMany({
                where: whereClause,
                orderBy: {
                    created_at: 'desc'
                },
                skip: skip,
                take: parseInt(limit),
                include: {
                    campaign: {
                        select: {
                            id: true,
                            name: true,
                            description: true
                        }
                    }
                }
            }),
            prisma.cashbackTransactions.count({
                where: whereClause
            })
        ]);

        const totalPages = Math.ceil(totalCount / parseInt(limit));

        return res.status(200).json(new ApiResponse(200,{
            transactions: transactions.map(t => ({
                id: t.id,
                transactionId: t.transaction_id,
                transactionAmount: t.transaction_amount,
                cashbackPercentage: t.cashback_percentage,
                cashbackAmount: t.cashback_amount,
                cashbackType: t.cashback_type,
                status: t.status,
                campaign: t.campaign ? {
                    id: t.campaign.id,
                    name: t.campaign.name,
                    description: t.campaign.description
                } : null,
                processedAt: t.processed_at,
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
        console.error('Error fetching cashback transactions:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
})

export { calculateCashback, getCashbackHistory, getCashbackTransactions}
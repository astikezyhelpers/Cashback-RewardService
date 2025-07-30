import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import prisma from "../lib/prisma.js";


const getLoyaltyPrograms = asyncHandler(async (req, res) => {
    try {
        const programs = await prisma.loyaltyPrograms.findMany({
            where: {
                is_active: true
            },
            orderBy: {
                created_at: 'desc'
            },
            select: {
                id: true,
                name: true,
                description: true,
                tier_type: true,
                benefits: true,
                requirements: true,
                min_spending: true,
                max_spending: true,
                created_at: true
            }
        });

        const formattedPrograms = programs.map(program => ({
            id: program.id,
            name: program.name,
            description: program.description,
            tierType: program.tier_type,
            benefits: program.benefits,
            requirements: program.requirements,
            spendingRange: {
                min: program.min_spending || 0,
                max: program.max_spending || null
            },
            createdAt: program.created_at
        }));

        return res.status(200).json(new ApiResponse(200, formattedPrograms));

    } catch (error) {
        console.error('Error fetching loyalty programs:', error);
        throw new ApiError(500, "Internal server error while getting loyalty program", error.message)
    }
})

const getLoyaltyStatus = asyncHandler(async (req, res) => {
    try {
        const { userId } = req.params;
        const userIdToUse = userId || req.user.id;

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
        const requirements = loyaltyProgram.requirements;

        // Calculate next tier info
        const tierKeys = Object.keys(requirements);
        const currentTierIndex = tierKeys.indexOf(current_tier);
        const nextTier = currentTierIndex < tierKeys.length - 1 ? tierKeys[currentTierIndex + 1] : null;
        const nextTierRequirement = nextTier ? requirements[nextTier] : null;

        const status = {
            userId: userStatus.user_id,
            program: {
                id: loyaltyProgram.id,
                name: loyaltyProgram.name,
                description: loyaltyProgram.description,
                tierType: loyaltyProgram.tier_type
            },
            currentTier: {
                name: current_tier,
                benefits: loyaltyProgram.benefits[current_tier] || [],
                achievedDate: userStatus.tier_achieved_date,
                expiryDate: userStatus.tier_expiry_date
            },
            progress: {
                totalSpending: userStatus.total_spending,
                tierProgress: userStatus.tier_progress,
                nextTier: nextTier,
                nextTierRequirement: nextTierRequirement,
                progressPercentage: nextTierRequirement
                    ? Math.min((userStatus.tier_progress / nextTierRequirement) * 100, 100)
                    : 100
            },
            lastUpdated: userStatus.last_updated
        };

        // res.json(status);

        res.status(200).json(new ApiResponse(200, status));

    } catch (error) {
        console.error('Error fetching loyalty status:', error);
        // res.status(500).json({ error: 'Internal server error', details: error.message });
        throw new ApiError(500, "Internal server error in getLoyaltyStatus", error.message)
    }
})

const upgradeLoyaltyTier = asyncHandler(async (req,res) => {
    try {
        const { userId } = req.params;
        const userIdToUse = userId || req.user.id;
        const { totalSpending } = req.body;

        if (!totalSpending) {
            throw new ApiError(400,"Total spending amount required")
        }

        const result = await prisma.$transaction(async (tx) => {
            const currentStatus = await tx.userLoyaltyStatus.findFirst({
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

            if (!currentStatus || !currentStatus.loyaltyProgram) {
                throw new Error('User not enrolled in loyalty program');
            }

            const { current_tier, loyaltyProgram } = currentStatus;
            const requirements = loyaltyProgram.requirements;

            const tierKeys = Object.keys(requirements).sort((a, b) => requirements[b] - requirements[a]);
            let newTier = current_tier;

            for (const tier of tierKeys) {
                if (totalSpending >= requirements[tier]) {
                    newTier = tier;
                    break;
                }
            }

            if (newTier === current_tier) {
                return {
                    upgraded: false,
                    currentTier: current_tier,
                    totalSpending: parseFloat(totalSpending),
                    message: 'No tier upgrade available'
                };
            }

            const updatedStatus = await tx.userLoyaltyStatus.update({
                where: {
                    id: currentStatus.id
                },
                data: {
                    current_tier: newTier,
                    total_spending: totalSpending,
                    tier_progress: totalSpending,
                    tier_achieved_date: new Date(),
                    tier_expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                    last_updated: new Date()
                }
            });

            await tx.rewardHistory.create({
                data: {
                    user_id: userIdToUse,
                    action_type: 'TIER_UPGRADE',
                    points_change: 0,
                    cashback_change: 0,
                    description: `Upgraded from ${current_tier} to ${newTier} tier`,
                    metadata: {
                        previous_tier: current_tier,
                        new_tier: newTier,
                        spending_amount: totalSpending
                    },
                    created_at: new Date()
                }
            });

            return {
                upgraded: true,
                previousTier: current_tier,
                newTier: newTier,
                totalSpending: parseFloat(totalSpending),
                updatedStatus,
                message: `User upgraded from ${current_tier} to ${newTier}`
            };
        });

        return res.status(200).json(new ApiResponse(400, result));

    } catch (error) {
        console.error('Tier upgrade error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
})

export { getLoyaltyPrograms, getLoyaltyStatus , upgradeLoyaltyTier};
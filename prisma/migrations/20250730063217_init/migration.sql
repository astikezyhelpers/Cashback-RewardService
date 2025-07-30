-- CreateTable
CREATE TABLE "public"."loyalty_programs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tier_type" TEXT NOT NULL,
    "benefits" JSONB NOT NULL,
    "requirements" JSONB NOT NULL,
    "min_spending" DECIMAL(10,2) DEFAULT 0,
    "max_spending" DECIMAL(10,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_loyalty_status" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "current_tier" TEXT NOT NULL,
    "total_spending" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tier_progress" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tier_achieved_date" TIMESTAMP(3),
    "tier_expiry_date" TIMESTAMP(3),
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_loyalty_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reward_points" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "points_earned" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "points_available" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "points_redeemed" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "points_expired" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT,
    "expiry_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cashback_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "transaction_amount" DECIMAL(10,2) NOT NULL,
    "cashback_percentage" DECIMAL(5,2) NOT NULL,
    "cashback_amount" DECIMAL(10,2) NOT NULL,
    "cashback_type" TEXT NOT NULL,
    "campaign_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cashback_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reward_redemptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "points_used" DECIMAL(10,2) NOT NULL,
    "redemption_type" TEXT NOT NULL,
    "redemption_details" JSONB,
    "cash_value" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reward_points_id" TEXT,

    CONSTRAINT "reward_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "campaign_type" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "rewards" JSONB NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "min_transaction" DECIMAL(10,2),
    "max_cashback" DECIMAL(10,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_campaigns" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "total_earned" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "last_used" TIMESTAMP(3),
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reward_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "points_change" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "cashback_change" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_loyalty_status_id" TEXT,

    CONSTRAINT "reward_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_loyalty_status_user_id_program_id_key" ON "public"."user_loyalty_status"("user_id", "program_id");

-- CreateIndex
CREATE UNIQUE INDEX "cashback_transactions_transaction_id_key" ON "public"."cashback_transactions"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_campaigns_user_id_campaign_id_key" ON "public"."user_campaigns"("user_id", "campaign_id");

-- AddForeignKey
ALTER TABLE "public"."user_loyalty_status" ADD CONSTRAINT "user_loyalty_status_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."loyalty_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cashback_transactions" ADD CONSTRAINT "cashback_transactions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reward_redemptions" ADD CONSTRAINT "reward_redemptions_reward_points_id_fkey" FOREIGN KEY ("reward_points_id") REFERENCES "public"."reward_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_campaigns" ADD CONSTRAINT "user_campaigns_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reward_history" ADD CONSTRAINT "reward_history_user_loyalty_status_id_fkey" FOREIGN KEY ("user_loyalty_status_id") REFERENCES "public"."user_loyalty_status"("id") ON DELETE SET NULL ON UPDATE CASCADE;

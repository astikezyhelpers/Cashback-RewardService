### CTMS Cashback & Rewards Service — Detailed Workflow


#### 1) Prerequisites
- Node.js 20+
- PostgreSQL (DATABASE_URL)
- Prisma CLI: `npx prisma -v`
- Recommended: Postman/cURL


#### 2) Environment setup
Create a `.env` in the project root:

```
PORT=3009
NODE_ENV=development
DATABASE_URL="postgresql://<user>:<password>@<host>:<port>/<db>?schema=public"
```

Notes:
- `src/index.js` reads env via `dotenv/config`.
- Server port defaults to 3009 if `PORT` is not set.


#### 3) Install & generate client
- Install deps: `npm install`
- Generate Prisma client: `npx prisma generate`
- Apply migrations (dev): `npx prisma migrate dev`


#### 4) Run the service
- Dev: `npm run dev` (runs `nodemon src/index.js`)
- Start logs: watch the console for "Server running on port <PORT>"


#### 5) High-level request flow
- Entry: `src/index.js` → boots Express `app`
- App setup: `src/app.js`
  - JSON/urlencoded parsers, static files, `cookie-parser`
  - Routers mounted at:
    - `/api/v1/rewards` → `src/routes/reward.route.js`
    - `/api/v1/cashback` → `src/routes/cashback.route.js`
    - `/api/v1/loyalty` → `src/routes/loyalty.route.js`
  - Error handling middleware: `src/middleware/errorHandler.middleware.js`
- Controllers in `src/controller/*` perform data access with Prisma via `src/lib/prisma.js`


#### 6) Error/response contracts
- Success wrapper: `ApiResponse` { statusCode, data, message, success }
- Error wrapper: `ApiError` { statusCode, message, code, details }
- Centralized error middleware shapes error responses consistently.


#### 7) Endpoint workflows

- Cashback
  - POST `/api/v1/cashback/calculate`
    - Body: `{ userId?, transactionAmount, transactionId?, category? }`
    - Flow:
      1. Resolve `userIdToUse = body.userId || req.user.id`.
      2. Validate `transactionAmount`.
      3. Load active loyalty status: `user_loyalty_status` with `loyalty_programs` join.
      4. Derive base tier cashback rate from `loyalty_programs.benefits[current_tier]` (fallback 5%).
      5. Load active campaigns (`campaigns` with optional `user_campaigns` for the user) filtered by active window and min transaction.
      6. Choose best matching campaign by category and effective rate = `rewards.cashback_rate * rules.multiplier`, respecting per-user `max_cashback` cap.
      7. Compute `cashbackAmount = transactionAmount * finalCashbackRate` and apply remaining cap (if applicable) to get `cappedCashbackAmount`.
      8. Return calculation details only (no persistence currently).
    - Sample request:
      ```bash
      curl -X POST http://localhost:3009/api/v1/cashback/calculate \
        -H "Content-Type: application/json" \
        -d '{
          "userId": "<uuid>",
          "transactionAmount": 1200.50,
          "transactionId": "TXN-12345",
          "category": "electronics"
        }'
      ```
    - Sample success shape (excerpt):
      ```json
      {
        "statusCode": 200,
        "success": true,
        "data": {
          "userId": "<uuid>",
          "transactionId": "TXN-12345",
          "transactionAmount": 1200.5,
          "cashback": {
            "rate": 0.1,
            "amount": 120.05,
            "tier": "gold",
            "campaignId": "<uuid>",
            "campaignName": "Festival Boost"
          }
        }
      }
      ```
    - Persistence: Not implemented in controller. Historical endpoints assume data exists in `cashback_transactions`.

  - GET `/api/v1/cashback/:userId/summary`
    - Flow:
      1. Resolve `userIdToUse` from params or `req.user.id`.
      2. Aggregate totals from `cashback_transactions` (count, sum amount, avg %).
      3. Group by `status` to break down received vs pending.
      4. Aggregate current month earned.
      5. Distinct `campaign_id` used and last cashback date.
      6. Return summary with derived metrics.

  - GET `/api/v1/cashback/:userId/transactions`
    - Query: `page`, `limit`, `status?`, `campaign_id?`, `start_date?`, `end_date?`
    - Flow: Build `where`, paginate with skip/take, include `campaign` details, return list + pagination meta.

- Rewards
  - GET `/api/v1/rewards/:userId`
    - Flow:
      1. Aggregate `reward_points` for totals (earned, available, redeemed, expired).
      2. Load `user_loyalty_status` with `loyalty_programs` (for tier info).
      3. Count `reward_points` expiring within 30 days.
      4. Return summary with both points and loyalty snapshot.

  - POST `/api/v1/rewards/redeem`
    - Body: `{ userId?, pointsToRedeem, redemptionType, redemptionDetails? }`
    - Flow (transactional):
      1. Validate required fields.
      2. Aggregate available points; error if insufficient.
      3. Compute cash value (100 pts = 1 unit currency).
      4. Create `reward_redemptions` row (status COMPLETED, timestamps).
      5. FIFO deduct from `reward_points` by `created_at`.
      6. Insert `reward_history` for audit trail.
      7. Return redemption summary.

  - GET `/api/v1/rewards/:userId/history`
    - Query: `page`, `limit`, `action_type?`, `start_date?`, `end_date?`
    - Flow: Filtered `reward_history` with pagination; return list + meta.

- Loyalty
  - GET `/api/v1/loyalty/programs`
    - Flow: List active `loyalty_programs`, map fields to friendlier shape.

  - GET `/api/v1/loyalty/:userId/status`
    - Flow:
      1. Load `user_loyalty_status` + `loyalty_programs`.
      2. Compute current tier, benefits, progress, next tier requirement, progress percentage.

  - PUT `/api/v1/loyalty/:userId/upgrade`
    - Body: `{ totalSpending }`
    - Flow (transactional):
      1. Validate `totalSpending`.
      2. Load current status + program.
      3. Determine highest tier whose requirement ≤ `totalSpending`.
      4. If unchanged, return no-op result.
      5. Update `user_loyalty_status` fields (tier, progress, dates).
      6. Insert `reward_history` entry with `TIER_UPGRADE`.
      7. Return upgrade result.


#### 8) Data model touchpoints (Prisma)
- `LoyaltyPrograms` ↔ `UserLoyaltyStatus`
- `RewardPoints` → aggregates, FIFO deductions
- `CashbackTransactions` → summaries and listings
- `RewardRedemptions` → redemption records
- `Campaigns`/`UserCampaigns` → campaign rules, caps, user usage
- `RewardHistory` → audit trail


#### 9) Authentication/identity expectations
- Controllers frequently use `req.user.id` as a fallback to `userId` param/body.
- No auth middleware is present in this repo; supply `userId` explicitly in requests, or add auth middleware that sets `req.user`.


#### 10) Example cURL suite

- Rewards summary
  ```bash
  curl http://localhost:3009/api/v1/rewards/<userId>
  ```

- Redeem points
  ```bash
  curl -X POST http://localhost:3009/api/v1/rewards/redeem \
    -H "Content-Type: application/json" \
    -d '{
      "userId": "<uuid>",
      "pointsToRedeem": 1500,
      "redemptionType": "CASH_REDEMPTION",
      "redemptionDetails": {"target": "wallet"}
    }'
  ```

- Cashback calculate
  ```bash
  curl -X POST http://localhost:3009/api/v1/cashback/calculate \
    -H "Content-Type: application/json" \
    -d '{
      "userId": "<uuid>",
      "transactionAmount": 500,
      "transactionId": "TXN-999",
      "category": "grocery"
    }'
  ```

- Loyalty status
  ```bash
  curl http://localhost:3009/api/v1/loyalty/<userId>/status
  ```


#### 11) Known caveats in current code
- Cashback calculate does not persist to `cashback_transactions`. History/summary endpoints assume data exists. Consider inserting a transaction row when calculation completes.
- Loyalty upgrade response currently constructs `ApiResponse` with statusCode 400 while sending HTTP 200. This leads to `success: false` in the JSON body. Align status codes for consistency.
- Authentication is not implemented; clients must pass `userId`. Add auth middleware if needed.


#### 12) Ops runbook (quick)
- Health: Add `/health` endpoint if required (not present). See README for suggested health endpoints.
- Migrations in CI/CD: run `npx prisma migrate deploy` on startup for prod; use `migrate dev` locally.
- Logging: Currently console-only. Centralize with your preferred logger if needed.
- Caching: README proposes Redis patterns; not implemented in code yet.


#### 13) References
- Code entry: `src/index.js`, `src/app.js`
- Routers: `src/routes/*`
- Controllers: `src/controller/*`
- Prisma: `src/lib/prisma.js`, `prisma/schema.prisma`
- Error handling: `src/middleware/errorHandler.middleware.js`
- Design details & diagrams: `README.md` 
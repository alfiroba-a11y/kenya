# Kazi Kenya

Kazi Kenya is a Kenya-focused online-work skills hub with 19 workspaces. Each has six sequential levels of 10 job-focused questions. Level 1 is free; questions and answer choices are randomized, and a score of 7/10 unlocks the next level. Progress is saved per account in MongoDB.

## Deploy on Render
1. Push this folder to GitHub and create a Render **Web Service** from the repository. Runtime: Node. Build command: `npm install`; start command: `npm start`.
2. Create a MongoDB Atlas free M0 cluster (Render does not provide a free hosted Mongo database). Allow the Render service outbound access in Atlas network access, create a database user, and set `MONGODB_URI` in Render to the Atlas connection string.
3. Add the environment variables from `.env.example` in Render. Generate unique long random values for `JWT_SECRET` and `ADMIN_TOKEN`. Keep API keys and webhook secrets private.
4. In HashPay, configure the webhook URL as `https://YOUR-RENDER-HOST/api/payments/hashpay/webhook`, then set its signing secret as `HASHPAY_WEBHOOK_SECRET`. Set the payment channel's public account ID as `HASHPAY_ACCOUNT_ID`.
5. Ensure the HashPay account is approved and funded for B2C payouts before enabling withdrawals. B2C credentials are server-only.

MongoDB Atlas is used because Render's free web service does not bundle a persistent SQL database. The application refuses to start without a valid MongoDB connection.

## Money flow
- Deposit initiation creates a pending order on the server, fixes its expected amount and unique reference, then opens HashPay's hosted M-Pesa payment UI. A browser success message never credits funds. Only a valid HMAC-SHA256 signed HashPay webhook credits the exact matching order, once.
- Withdrawals (KES 1,250 minimum) are enabled once a user's available balance reaches KES 1,250. Requests are held as pending against the user's wallet and require an admin review. An authorized admin triggers the HashPay B2C payout; duplicate payouts are prevented with an atomic status transition. Configure `ADMIN_TOKEN` securely and expose its use only to a trusted operator.
- Workspace quizzes save learning progress but do not award money. The KES 1,250 shown while logged out is labeled demo preview and is not a real balance.
- New accounts start at KES 0. Only verified deposits and operator-credited client-paid work affect the wallet. A level completion is not a promise of a job or earnings.

## API overview
- `POST /api/auth/register`, `POST /api/auth/login`
- `GET /api/workspaces`, `GET /api/workspaces/progress`
- `GET /api/workspaces/:slug/levels/:level/questions`, `POST /api/workspaces/:slug/levels/:level/complete`
- `GET /api/me`, `GET /api/wallet`, `GET /api/wallet/transactions`
- `POST /api/payments/deposit` `{ "amount": 650 }` (minimum KES 650)
- `POST /api/wallet/withdrawals` `{ "amount": 1250, "phone": "0712345678" }` (minimum KES 1,250)
- `POST /api/payments/hashpay/webhook` (HashPay signed callback)
- `GET /api/health`
- Operator queue: `GET /api/admin/withdrawals` with `x-admin-token: $ADMIN_TOKEN`; trigger `POST /api/admin/withdrawals/:id/pay` with the same header.
- Credit `POST /api/admin/earnings` only after real client-paid work is verified. Send `{ "email": "worker@example.com", "amount": 500, "workReference": "client-task-unique-id" }` with `x-admin-token: $ADMIN_TOKEN`. The work reference is idempotent. Quiz results never add wallet money.
- If a payout request times out, it stays reserved as `processing`. Check HashPay's portal, then call `POST /api/admin/withdrawals/:id/reconcile` with `{ "outcome": "paid", "payoutId": "..." }` or `{ "outcome": "failed" }`. Never retry an ambiguous transfer before checking its status.

No fake payment success, payout activity, or seeded balance is stored. Use a HashPay test channel first and verify signed webhook delivery end-to-end before accepting live funds. Set the HashPay channel callback to the webhook URL above.

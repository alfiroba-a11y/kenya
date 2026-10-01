# Kazi Kenya

Kazi Kenya is a Kenya-focused online-work skills hub with 19 workspaces. Each has six job-focused levels of 10 questions. Question order and answer choices are randomized. Every level is locked until confirmed deposits total KES 650 and at least KES 650 is currently available; progress is saved per account in MongoDB. Quiz scores add non-cash skill points.

## Deploy on Render
1. Push this folder to GitHub and create a Render **Web Service** from the repository. Runtime: Node. Build command: `npm install`; start command: `npm start`.
2. Create a MongoDB Atlas free M0 cluster, create a database user, and set `MONGODB_URI` in Render.
3. Add environment variables from `.env.example`. Set a unique `ADMIN_PASSWORD` and a long random `JWT_SECRET`; keep credentials private.
4. The app has a fallback `ADMIN_PATH`. Set a private route in Render if you want a different one. The admin portal always requires login.
5. Configure `PAYMENT_ACCOUNT_ID`, `PAYMENT_API_KEY`, `PAYMENT_WEBHOOK_SECRET`, and `PAYMENT_SECURITY_CREDENTIAL` in Render. Set the payment service callback to `https://YOUR-RENDER-HOST/api/payments/callback`.

MongoDB Atlas is used because Render's free web service does not bundle a persistent database. The application requires a valid MongoDB connection.

## Wallet and transaction codes
- Deposits start an M-Pesa prompt to the phone number entered in the Kazi Kenya wallet. A signed payment callback confirms the amount, phone, account, and reference before crediting the wallet. An administrator can also confirm a deposit after verifying it arrived.
- Withdrawals are KES 1,250–12,000 and require at least KES 1,250 available. Admins can send a withdrawal or reconcile an uncertain request. The portal does not ask an admin to enter a payment receipt or payout code.
- Each transaction receives a globally reserved unique code such as `KYT-20261001-...`. Its code remains the same when a pending deposit or withdrawal is completed and is shown in member transaction history.
- Admin wallet actions are only deposit or withdraw. They update the balance and create a matching transaction-history entry with the admin's reason.
- Quizzes save learning progress but do not award or deduct cash. Earnings in the wallet come from confirmed deposits, admin-recorded deposit/withdraw transactions, or verified client-paid work.

## API overview
- `POST /api/auth/register`, `POST /api/auth/login`
- `GET /api/workspaces`, `GET /api/workspaces/progress`
- `GET /api/me`, `PATCH /api/profile`, `PATCH /api/profile/password`
- `GET /api/wallet`, `GET /api/wallet/transactions`
- `POST /api/payments/deposit` (minimum KES 650)
- `POST /api/wallet/withdrawals` (KES 1,250–12,000)
- `POST /api/payments/callback` for signed payment notifications
- `POST /api/admin/login`, `GET /api/admin/overview`
- `POST /api/admin/deposits/:id/approve` with `{ "confirmedReceived": true }` after verifying receipt of funds
- `POST /api/admin/members/:id/wallet-transactions` with `{ "action": "deposit" | "withdraw", "amount": 650, "reason": "..." }`
- `POST /api/admin/withdrawals/:id/pay` to initiate a transfer, or `POST /api/admin/withdrawals/:id/reconcile` with `{ "outcome": "paid" }` / `{ "outcome": "failed" }` after checking its status
- `POST /api/admin/earnings` only after client-paid work is verified; a unique work reference prevents duplicate credits
- `GET/PATCH /api/admin/settings`, `GET /api/health`

New account passwords must be at least six characters. No fake payment success, payout activity, or seeded balance is stored. Verify callback delivery end-to-end before accepting live funds.

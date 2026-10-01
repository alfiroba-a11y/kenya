# Kazi Kenya

Kazi Kenya is a Kenya-focused online-work skills hub with 19 workspaces. Each has six job-focused levels of 10 questions. Question order and answer choices are randomized. Every level is locked until confirmed deposits total KES 650 and at least KES 650 is currently available; the balance dropping below KES 650 locks assessments again. Scores add non-cash skill points. Progress is saved per account in MongoDB.

## Deploy on Render
1. Push this folder to GitHub and create a Render **Web Service** from the repository. Runtime: Node. Build command: `npm install`; start command: `npm start`.
2. Create a MongoDB Atlas free M0 cluster (Render does not provide a free hosted Mongo database). Allow the Render service outbound access in Atlas network access, create a database user, and set `MONGODB_URI` in Render to the Atlas connection string.
3. Add the environment variables from `.env.example` in Render. Set `ADMIN_EMAIL` to the sole administrator email and set `ADMIN_PASSWORD` in Render to a new, unique strong password. Never put the administrator password in source control. Generate a unique long random `JWT_SECRET`; keep payment keys and webhook secrets private.
4. The app has a fallback `ADMIN_PATH` so a missing variable will not crash startup. Set a private `ADMIN_PATH` in Render beginning with `/kz-control-` if you want a different route, and open that path on your deployed host. The portal still requires the sole admin email and password.
5. In HashPay, configure the webhook URL as `https://YOUR-RENDER-HOST/api/payments/hashpay/webhook`, then set its signing secret as `HASHPAY_WEBHOOK_SECRET`. Set the payment channel's public account ID as `HASHPAY_ACCOUNT_ID` and its server API key as `HASHPAY_API_KEY`.
6. Ensure the HashPay account is approved and funded for B2C payouts before enabling withdrawals. B2C credentials are server-only.

MongoDB Atlas is used because Render's free web service does not bundle a persistent SQL database. The application refuses to start without a valid MongoDB connection.

## Money flow
- Deposit initiation asks for the user's M-Pesa number in the Kazi Kenya wallet, then the server calls HashPay's STK Push endpoint to send the prompt directly to that phone. The deposit remains pending until a valid HMAC-SHA256 signed HashPay webhook confirms the exact amount, phone, account, and reference; only then is the wallet credited once. The hosted checkout is not opened in the site.
- Withdrawals (KES 1,250–12,000) are enabled once a user's available balance reaches KES 1,250. Requests are held as pending against the user's wallet and require an admin review. An authorized admin triggers the HashPay B2C payout; duplicate payouts are prevented with an atomic status transition. The admin panel permits only `ADMIN_EMAIL` and requires `ADMIN_PASSWORD`; it issues a two-hour admin session. Ordinary registered accounts cannot access admin routes.
- Profile settings allow name/username changes and password changes with current-password verification. Withdrawal requests can specify their M-Pesa destination.
- Workspace quizzes save learning progress but do not award money. Quiz answers do not add to or deduct from the cash wallet. Correct answers earn configurable learning points, never shillings. Earnings shown are only operator-credited, verified client-paid work.
- New accounts start at KES 0. Only confirmed deposits and operator-credited client-paid work affect the wallet. Admin deposit approval requires checking the actual successful HashPay transaction and receipt before crediting. A level completion is not a promise of a job or earnings.

## API overview
- `POST /api/auth/register`, `POST /api/auth/login`
- `GET /api/workspaces`, `GET /api/workspaces/progress`
- `GET /api/workspaces/:slug/levels/:level/questions`, `POST /api/workspaces/:slug/levels/:level/complete`
- `GET /api/me`, `PATCH /api/profile`, `PATCH /api/profile/password`
- `GET /api/wallet`, `GET /api/wallet/transactions (completed ledger entries plus live pending deposit/withdrawal states)`
- `POST /api/payments/deposit` `{ "amount": 650, "phone": "0712345678" }` (minimum KES 650; starts an M-Pesa STK prompt)
- `POST /api/wallet/withdrawals` `{ "amount": 1250, "phone": "0712345678" }` (KES 1,250–12,000)
- `POST /api/payments/hashpay/webhook` (HashPay signed callback)
- `POST /api/admin/login` with the configured admin email and password; then call `GET /api/admin/overview` with its returned Bearer session (members and pending deposits)
- `POST /api/admin/deposits/:id/approve` with a verified HashPay receipt (manual reconciliation)
- `POST /api/admin/members/:id/wallet-transactions` with `{ "action": "deposit" | "withdraw", "amount": 650, "reason": "..." }`; admin credits and debits appear as deposit or withdrawal ledger entries
- `GET/PATCH /api/admin/settings` to tune non-cash points and six level multipliers
- `GET /api/health`
- Operator queue: `GET /api/admin/withdrawals` with the Bearer administrator session; trigger `POST /api/admin/withdrawals/:id/pay` with that session.
- Credit `POST /api/admin/earnings` only after real client-paid work is verified. Send `{ "email": "worker@example.com", "amount": 500, "workReference": "client-task-unique-id" }` with the administrator session. The work reference is idempotent. Quiz results never add wallet money.
- If a payout request times out, it stays reserved as `processing`. Check HashPay's portal, then call `POST /api/admin/withdrawals/:id/reconcile` with `{ "outcome": "paid", "payoutId": "..." }` or `{ "outcome": "failed" }`. Never retry an ambiguous transfer before checking its status.

New user account passwords must be at least six characters (including password changes). No fake payment success, payout activity, or seeded balance is stored. Use a HashPay test channel first and verify signed webhook delivery end-to-end before accepting live funds. Set the HashPay channel callback to the webhook URL above.

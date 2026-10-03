# Kazi Kenya

Kazi Kenya is a Kenya-focused online-work skills hub with 19 workspaces. Each has six job-focused levels of 10 questions. Question order and answer choices are randomized. Deposits have a KES 650 minimum. Confirmed KES 650 deposits add 325 level-unlock points at KES 2 per point. The 325 points are split evenly across the 114 workspace levels, each of which is unlocked individually and stays unlocked; progress is saved per account in MongoDB. The wallet displays verified work earnings only. Quiz scores add skill points. Approved points enter pending work earnings at 1 point = KES 1; a separate confirmation adds them to the wallet. Withdrawals require at least KES 1,250 marked ready.

## Deploy on Render
1. Push this folder to GitHub and create a Render **Web Service** from the repository. Runtime: Node. Build command: `npm install`; start command: `npm start`.
2. Create a MongoDB Atlas free M0 cluster, create a database user, and set `MONGODB_URI` in Render.
3. Add environment variables from `.env.example`. Set a unique `ADMIN_PASSWORD` and a long random `JWT_SECRET`; keep credentials private.
4. The app has a fallback `ADMIN_PATH`. Set a private route in Render if you want a different one. The admin portal always requires login.
5. Configure `PAYMENT_ACCOUNT_ID`, `PAYMENT_API_KEY`, `PAYMENT_WEBHOOK_SECRET`, and `PAYMENT_SECURITY_CREDENTIAL` in Render. Set the payment service callback to `https://YOUR-RENDER-HOST/api/payments/callback`.

MongoDB Atlas is used because Render's free web service does not bundle a persistent database. The application requires a valid MongoDB connection. Member accounts are stored in the portal-specific `kazi_kenya_users` collection, so other sites can use the same cluster without sharing this portal’s registrations. Existing accounts with Kazi-specific transaction records are copied from the legacy `users` collection at startup.

## Wallet and transaction codes
- Deposits start an M-Pesa prompt to the phone number entered in the Kazi Kenya wallet. A signed payment callback confirms the amount, phone, account, and reference before crediting the wallet. An administrator can also confirm a deposit after verifying it arrived.
- Withdrawals are KES 1,250–12,000 and cannot exceed the member’s amount marked ready. Requests show as processing; the administrator records the completed payout or releases a failed request. The portal does not ask an admin to enter a payment receipt or payout code.
- Each transaction receives a globally reserved unique code such as `KYT-20261001-...`. Its code remains the same when a pending deposit or withdrawal is completed and is shown in member transaction history.
- Admin wallet actions are only deposit or withdraw. They update the balance and create a matching transaction-history entry with the admin's reason.
- Quiz points are tracked separately until approved into pending work earnings and confirmed as available. Deposits and confirmed work earnings appear in available now; the wallet total also includes funds reserved for a processing withdrawal.

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

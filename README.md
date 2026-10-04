# Kazi Kenya

Kazi Kenya is a Kenya-focused online-work skills hub with 19 workspaces, six levels per workspace, and 10 questions per level. Questions are shuffled, each prompt is unique, and every question has its own distinct answer-choice set.

## Learning and unlock payments
- Each locked level opens after its own KES 30 M-Pesa payment is confirmed by the signed payment callback. Wallet deposits are disabled.
- A passed level stays complete. A failed level closes and requires another KES 30 unlock to retry.
- Correct answers add skill points as quiz progress. A passed level awards at least 200 skill points; this is not guaranteed cash or income. The administrator can verify skill points and separately confirm verified work earnings as available funds.
- Only withdrawals appear in member History. Withdrawals require at least KES 1,250 marked ready and are tracked as pending/processing/completed.

## Render deployment
1. Push this repository to GitHub and create a Render Web Service. Use Node, build command `npm install`, start command `npm start`.
2. Create a MongoDB Atlas database and set `MONGODB_URI` in Render.
3. Set `JWT_SECRET`, `ADMIN_PASSWORD`, `ADMIN_EMAIL`, and a private `ADMIN_PATH`. Keep secrets private.
4. Set payment environment values from `.env.example` and configure the provider callback at `https://YOUR-RENDER-HOST/api/payments/callback`. The KES 30 transaction needs to be supported by the configured payment account.

## API notes
- Auth: `POST /api/auth/register`, `POST /api/auth/login`.
- Assessments: `GET /api/workspaces`, `GET /api/workspaces/progress`, `POST /api/workspaces/:slug/levels/:level/unlock-payment`, `GET /api/levels/unlock-payments/:reference`, `GET /api/workspaces/:slug/levels/:level/questions`, `POST /api/workspaces/:slug/levels/:level/answer`, `POST /api/workspaces/:slug/levels/:level/complete`.
- Wallet: `GET /api/wallet`, `GET /api/wallet/transactions` (withdrawals only), `POST /api/wallet/withdrawals`. Wallet deposit endpoint returns Gone.
- Admin: private login, member and withdrawal controls, skill verification, earnings confirmation, and quiz settings.

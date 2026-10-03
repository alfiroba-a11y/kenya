# XCROW.COM

## Payment flows

### KES / M-Pesa STK Push — HashBack HashPay

When both buyer and seller confirm that the escrow is ready, the selected depositor sees an XCROW deposit summary and presses Deposit. XCROW sends the STK prompt server-side to the M-Pesa number saved in the depositor's profile. The amount and unique escrow reference are calculated on the server. A pending payment can receive a new STK prompt through the Resend payment prompt control.

HashPay calls this signed webhook after a successful payment:

`https://xcrow.online/webhooks/hashpay`

XCROW verifies the raw-body HMAC, matches the transaction reference and amount against the pending escrow payment, and then changes the escrow to **Funded**. A browser success callback does not mark funds paid.

For the live custom domain, set `HASHPAY_WEBHOOK_URL=https://xcrow.online/webhooks/hashpay` in Render. XCROW also includes that callback URL in every new STK request and reconciles a pending prompt against HashPay's transaction-status endpoint if a signed webhook is delayed.

### USDT / TRC20

XCROW uses HashPay's hosted USDT/TRON invoice checkout. That checkout presents the payment QR code and wallet address and HashPay confirms its result by signed webhook.

Do not use a screenshot as proof of a crypto transfer. Screenshots can be altered and do not prove final on-chain settlement. Use HashPay's signed invoice confirmation instead.

## Render variables

- `MONGO_URI`
- `JWT_SECRET`
- `HASHPAY_ACCOUNT_ID` — HashBack public account ID for the M-Pesa checkout
- `HASHPAY_WEBHOOK_SECRET` — HashBack webhook signing secret
- `HASHPAY_API_KEY` and `HASHPAY_ORGANIZATION_ID` — required for HashPay's USDT hosted invoice API
- `USD_KES_RATE`
- `ADMIN_EMAILS` — comma-separated administrator email addresses permitted to use the operations panel
- `ADMIN_PASSWORD` — private password accepted only through `/#admin`

## Protected administrator access

Open `/#admin` and use an email in `ADMIN_EMAILS` together with `ADMIN_PASSWORD`. The administrator portal has no sign-up path. After both server-held values match, XCROW provisions the protected administrator record if needed; ordinary public login never does this and never receives administrator access.

## Webhook setup

In your HashBack/HashPay settings, configure the public HTTPS endpoint above and use the webhook secret as `HASHPAY_WEBHOOK_SECRET` on Render. The service responds with success only after validating the signature.

Before operating a real escrow service, complete legal, KYC/AML, sanctions, custody, and payment-provider compliance requirements.

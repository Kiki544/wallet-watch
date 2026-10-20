# wallet-watch

Netlify Function that receives Helius webhooks and sends a Telegram alert when a watched Solana wallet sends a given token out (swap = SELL, plain transfer flagged separately).

Settings live in Netlify environment variables, not in this repo: WATCH_WALLET, WATCH_MINT, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, WEBHOOK_AUTH.

Webhook endpoint: /.netlify/functions/webhook (also /webhook). GET returns "ok" as a health check. POST requires the Authorization header to equal WEBHOOK_AUTH.

# VeggiesApp

Telegram bot + Firebase Admin webhook for updating product stock and price.

## About

This repository hosts a Telegram bot deployed on Vercel. It accepts `/refill` lists and updates Firestore `products` documents by mapping item names to document IDs.

## Commands

- `/help`: Shows usage.
- `/refill`: Send a list (one per line) in the format `Name, price, stock`.

Example:

```
/refill
Avocado, 0.95, 40
Pomme Fuji Apple, 0.3, 100
```

## Deployment (Vercel)

1. Create a Firebase Service Account key (Project Settings → Service accounts → Generate new private key). Copy the entire JSON.
2. In Vercel project settings, add Environment Variables:
   - `FIREBASE_KEY_JSON` = the full JSON string
   - `TELEGRAM_BOT_TOKEN` = your Telegram token
3. Deploy to Vercel.
4. Set Telegram webhook to your deployment URL:

```
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=https://<your-app>.vercel.app/api"
```

## Local dev

```
npm install
npm run dev
```

In another terminal, you can use a tunnel (e.g. `ngrok http 3000`) and set the webhook to your tunnel URL `/api`.



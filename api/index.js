import express from "express";
import fetch from "node-fetch";
import admin from "firebase-admin";

// Initialize Firebase Admin using service account JSON from env
const serviceAccountJson = process.env.FIREBASE_KEY_JSON;
if (!serviceAccountJson) {
  console.error("Missing FIREBASE_KEY_JSON env var");
}

const serviceAccount = serviceAccountJson ? JSON.parse(serviceAccountJson) : undefined;

if (!admin.apps.length && serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.apps.length ? admin.firestore() : null;

// Product map (name -> document ID)
const PRODUCT_MAP = {
  "1/2 Lamb": "xCRuuSQvxKcsvAC2WUIz",
  "Ananas sucré / Sweet Pineapple": "zngQiR5m5Ctqs2wjhmaG",
  "Aubergine Italian Eggplant": "uEx5W9erA64KrA65ivo6",
  "Aubergine Mini Eggplant": "afaliM9gQoYCdRjUuyx4",
  "Avocado": "ezjSgawBjVYj4O22U7og",
  "Bio Apple Honeycrisp Pomme Bio": "pMNCyPxYpBLSoI7bPeZW",
  "Cerise Jaune Yellow Cherry": "jabcwI1q2AtggHu1obt6",
  "Cerise Rouge Red Cherry": "bH4Pf7IqgIjo5rzM1SVP",
  "Chou Fleur Cauliflower": "Unz6FCMhhGkLtyLk6QB9",
  "Chou Vert Green Cabbage": "UdetFtbxorDEswH1jrLC",
  "Citron Lemon": "NHMYsmoOqH1MsFU22DTs",
  "Clementine ": "fwERowVcgCGmGgTaAwNa",
  "Concumbre Anglais English Cucumber": "PIOfr7ibAmy2OIJZ7t6I",
  "Coriandre Coriander": "ib2X9dHyiir0E0L4dvRJ",
  "Fraise Strawberry": "qpmAEmF1q4sTaXkHlGhm",
  "Framboise Raspberry": "ikr9C6v6teOqj5PFLZdO",
  "Full Lamb": "do8PQzog21d3G2AYfHIB",
  "Haricots Vert Green Beans": "jyvN0M5rsgVNXjCmCcTN",
  "Honeydew Melon Miel": "eds29fQvjzleMF2YNBtV",
  "Laitue Iceberg Lettuce": "zOHZhgCiValKftGtRhKI",
  "Mango Atauflo": "KdlVotbbWpf6GjCnRmY1",
  "Mango Atkins": "gcb5J1kI19zXoKy3dv54",
  "Onions Jaune Yellow Onions": "fO260IKOI8id8I8icG3T",
  "Patate Grelot Mini Yellow Potato": "TitF6hJ9V9huP9qQ3HKu",
  "Poire Cactus Pear": "qGXwZ6RAYmozVlpz0mYQ",
  "Poivron Rouge Red Bell Pepper": "MG944sCnUuUHAaQ57AiY",
  "Pomme Fuji Apple": "mrQFunMpEz0Zf15Yn1Rz",
  "Quarter Lamb": "vDsRBAm8IN7eQi7rB12T",
  "Raisin Rouge Red Grapes": "SSDC1Hk2jbc3GxGRb0SW",
  "Raisin Vert Green Grapes": "vh4AtHMcvEqqSSlD7KdE",
  "Tomate Cerise Cherry Tomato (2lbs Box) ": "uvX3uwNCLtgZyWPWozx5",
  "White zucchini / Zucchini blanc": "jwFXTj0cgrUDRHr6g5EJ",
  "🍁 Sirop d’Érable Pur / 🍁 Pure Maple Syrup": "BQQEM8a0na0MvqmmxMGW",
  "🍗 Poulet Entier Halal – Abattu à la Main (~2,5 kg) / 🍗 Whole Halal Chicken – Hand‑Slaughtered (~2.5 kg)": "F75545bpHatwM2xho7rY",
  "🍯 Miel Extra Blanc – Fleur de Jargeau / Extra‑White Honey – Jargeau Flower 🍯": "Bu5yy3nj9BqJ3PEIxkOc",
  "🍯Miel Blanc Bio – Trèfle / White Organic Honey – Clover 🍯": "6XuLMCgd3h14K7gmkssN",
  "🍯Miel Doré Foncé – Sarrasin & Fleurs Sauvages / Dark Golden Honey – Buckwheat & Wildflower🍯": "gW6RbzKqihb8Gt2Fzte4",
  "🥚 Œufs Plein Air /🥚 Farm Eggs": "W43TcWWYTOJhAvYH8J5r",
};

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_API = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : null;

async function sendMessage(chatId, text) {
  if (!TELEGRAM_API) return;
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

const app = express();
app.use(express.json());

app.post("*", async (req, res) => {
  const update = req.body;
  const msg = update && update.message;
  if (!msg || !msg.text) {
    return res.status(200).send("ok");
  }

  const chatId = msg.chat.id;
  const text = msg.text.trim();

  if (text.startsWith("/help")) {
    await sendMessage(
      chatId,
      "Usage:\n/refill\nName, price, stock\n\nExample:\n/refill\nAvocado, 0.95, 40\nPomme Fuji Apple, 0.3, 100"
    );
  } else if (text.startsWith("/refill")) {
    if (!db) {
      await sendMessage(chatId, "Server misconfigured: DB not initialized");
      return res.status(200).send("ok");
    }
    const lines = text.split("\n").slice(1);
    const results = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length !== 3) {
        results.push(`❌ Bad format: ${line}`);
        continue;
      }
      const [name, priceStr, stockStr] = parts;
      const docId = PRODUCT_MAP[name];
      if (!docId) {
        results.push(`❌ Unknown item: ${name}`);
        continue;
      }
      const price = Number.parseFloat(priceStr);
      const stock = Number.parseInt(stockStr, 10);
      if (!Number.isFinite(price) || !Number.isFinite(stock)) {
        results.push(`❌ Invalid numbers: ${line}`);
        continue;
      }
      try {
        await db.collection("products").doc(docId).update({ price, stock });
        results.push(`✅ ${name} → price ${price}, stock ${stock}`);
      } catch (err) {
        results.push(`❌ ${name} failed: ${err.message}`);
      }
    }
    await sendMessage(chatId, results.join("\n") || "No lines to process");
  } else {
    await sendMessage(chatId, "Unknown command. Use /help");
  }

  return res.status(200).send("ok");
});

export default function handler(req, res) {
  return app(req, res);
}



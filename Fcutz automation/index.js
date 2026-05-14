require("dotenv").config();
const express = require("express");
const app = express();

app.use(express.json());

const { handleMessage } = require("./agent");

// ========================
// 🔐 VERIFY WEBHOOK META
// ========================
app.get("/webhook/instagram", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("🔐 Webhook verification request");

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    console.log("✅ Webhook vérifié");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// ========================
// 📩 INSTAGRAM WEBHOOK (DEBUG VERSION)
// ========================
app.post("/webhook/instagram", async (req, res) => {
  console.log("🚨 WEBHOOK HIT RAW");
  console.log("BODY:", JSON.stringify(req.body, null, 2));

  try {
    const body = req.body;

    // IMPORTANT: on ne filtre PLUS pour debug
    if (body.object) {
      console.log("📦 Object type:", body.object);

      for (const entry of body.entry || []) {
        console.log("📥 ENTRY:", JSON.stringify(entry, null, 2));

        for (const event of entry.messaging || []) {
          console.log("📨 EVENT:", JSON.stringify(event, null, 2));

          // on ne bloque plus sur is_echo pour debug
          if (event.sender && event.message) {
            const senderId = event.sender.id;
            const text = event.message.text;

            console.log("📩 MESSAGE DETECTED:");
            console.log("senderId:", senderId);
            console.log("text:", text);

            console.log("➡️ CALLING AI");

            await handleMessage(senderId, text, {
              accessToken: process.env.META_ACCESS_TOKEN,
            });
          }
        }
      }
    }
  } catch (err) {
    console.error("❌ WEBHOOK ERROR:", err);
  }

  res.sendStatus(200);
});

// ========================
// 🧪 TEST WEBHOOK
// ========================
app.post("/test-webhook", async (req, res) => {
  console.log("🧪 TEST WEBHOOK");
  console.log(req.body);

  try {
    const senderId = req.body.sender || "test-user";
    const text = req.body.message || "test";

    await handleMessage(senderId, text, {
      accessToken: process.env.META_ACCESS_TOKEN,
    });

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ TEST ERROR:", err);
    res.sendStatus(500);
  }
});

// ========================
// ❤️ HEALTH CHECK
// ========================
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    bot: "FCUTZ",
  });
});

// ========================
// 🚀 START SERVER
// ========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});

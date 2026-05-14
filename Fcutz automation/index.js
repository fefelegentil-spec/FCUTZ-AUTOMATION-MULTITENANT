require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());

const { handleMessage } = require('./agent');

// ========================
// 🔐 VERIFY WEBHOOK META
// ========================
app.get('/webhook/instagram', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log("🔐 Webhook verification request");

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    console.log('✅ Webhook vérifié par Meta');
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// ========================
// 📩 INSTAGRAM WEBHOOK
// ========================
app.post('/webhook/instagram', async (req, res) => {
  console.log("🔥 INSTAGRAM WEBHOOK HIT");
  console.log(JSON.stringify(req.body, null, 2));

  try {
    const body = req.body;

    if (body.object === 'instagram') {
      for (const entry of body.entry || []) {
        for (const event of entry.messaging || []) {

          if (event.message && !event.message.is_echo) {
            const senderId = event.sender.id;
            const text = event.message.text;

            console.log(`📩 IG Message de ${senderId}: ${text}`);
            console.log("➡️ CALLING AI");

            await handleMessage(senderId, text, {
              accessToken: process.env.META_ACCESS_TOKEN,
              instagramAccountId: process.env.INSTAGRAM_ACCOUNT_ID
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
app.post('/test-webhook', async (req, res) => {
  console.log("🧪 TEST WEBHOOK REÇU");
  console.log(req.body);

  try {
    const senderId = req.body.sender || "test-user";
    const text = req.body.message || "empty";

    console.log("➡️ CALLING AI (TEST)");

    await handleMessage(senderId, text, {
      accessToken: process.env.META_ACCESS_TOKEN,
      instagramAccountId: process.env.INSTAGRAM_ACCOUNT_ID
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
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    bot: 'BarberBot'
  });
});

// ========================
// 🚀 START SERVER
// ========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 BarberBot lancé sur le port ${PORT}`);
});

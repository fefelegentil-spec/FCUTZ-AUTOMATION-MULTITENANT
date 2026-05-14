require('dotenv').config();
const express = require('express');
const app = express();
app.use(express.json());

const { handleMessage } = require('./agent');

// ✅ Vérification du webhook par Meta
app.get('/webhook/instagram', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    console.log('✅ Webhook vérifié par Meta');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// 📨 Réception des messages Instagram
app.post('/webhook/instagram', async (req, res) => {

  console.log("🔥 WEBHOOK HIT");
  console.log("BODY:", JSON.stringify(req.body, null, 2));

  const body = req.body;

  if (body.object === 'instagram') {
    for (const entry of body.entry) {
      for (const event of (entry.messaging || [])) {
        if (event.message && !event.message.is_echo) {
          const senderId = event.sender.id;
          const text = event.message.text;

          console.log(`📩 Message de ${senderId}: ${text}`);

          handleMessage(senderId, text).catch(console.error);
        }
      }
    }
  }

  res.sendStatus(200);
});

// 🧪 TEST WEBHOOK (local debug)
app.post('/test-webhook', (req, res) => {
  console.log("🔥 TEST WEBHOOK REÇU");
  console.log("BODY:", req.body);

  res.sendStatus(200);
});

// Route de santé pour Railway
app.get('/health', (req, res) => {
  res.json({ status: 'ok', bot: 'BarberBot' });
});

// 🚀 START SERVER (IMPORTANT : doit être à la fin)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 BarberBot lancé sur le port ${PORT}`));

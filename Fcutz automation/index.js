require('dotenv').config();
const express = require('express');
const app = express();
app.use(express.json());

const { handleMessage } = require('./agent');

// ✅ Vérification du webhook par Meta (fait une seule fois au démarrage)
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
  const body = req.body;

  if (body.object === 'instagram') {
    for (const entry of body.entry) {
      for (const event of (entry.messaging || [])) {
        if (event.message && !event.message.is_echo) {
          const senderId = event.sender.id;
          const text = event.message.text;

          console.log(`📩 Message de ${senderId}: ${text}`);

          // On lance l'agent en arrière-plan
          handleMessage(senderId, text).catch(console.error);
        }
      }
    }
  }

  // Toujours répondre 200 à Meta rapidement
  res.sendStatus(200);
});

// Route de santé pour Railway
app.get('/health', (req, res) => res.json({ status: 'ok', bot: 'BarberBot' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 BarberBot lancé sur le port ${PORT}`));

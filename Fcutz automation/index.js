// ================================================
// index.js — Multi-tenant
// Identifie le salon via l'Instagram Page ID
// reçu dans le webhook Meta
// ================================================

require('dotenv').config();
const express = require('express');
const app = express();
app.use(express.json());

const { handleMessage } = require('./agent');
const { sendMessage } = require('./instagram');
const { getSalonByPageId } = require('./salons');

// ========================
// 🔐 WEBHOOK VERIFY META
// ========================
app.get('/webhook/instagram', (req, res) => {
  console.log('🔐 VERIFY WEBHOOK HIT');
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && challenge) {
    // Vérifie le token pour la sécurité
    if (token !== process.env.VERIFY_TOKEN) {
      console.log('❌ VERIFY TOKEN INVALIDE');
      return res.sendStatus(403);
    }
    console.log('✅ VERIFY OK');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(400);
});

// ========================
// 📩 INSTAGRAM WEBHOOK
// ========================
app.post('/webhook/instagram', async (req, res) => {
  console.log('🚨 WEBHOOK HIT');
  try {
    const body = req.body;

    if (body.object) {
      for (const entry of body.entry || []) {

        // ── Récupère l'ID de la page Instagram (= identifiant du salon) ──
        const pageId = entry.id;
        const salon = getSalonByPageId(pageId);

        if (!salon) {
          console.warn(`⚠️ Aucun salon configuré pour pageId: ${pageId} — message ignoré`);
          continue;
        }

        console.log(`🏪 Salon identifié: ${salon.name}`);

        // ── CAS 1 — DM classique ──
        for (const event of entry.messaging || []) {
          if (event.sender && !event.message?.is_echo) {
            const senderId = event.sender.id;
            const text = event.message?.text || null;

            if (!text) {
              await sendMessage(senderId, "je peux pas écouter les vocaux, tu peux m'écrire ?", salon.metaAccessToken);
              continue;
            }

            console.log(`📩 [${salon.name}] DM de ${senderId}: ${text}`);
            await handleMessage(senderId, text, salon);
          }
        }

        // ── CAS 2 — Réponse à une story ──
        for (const change of entry.changes || []) {
          if (
            change.field === 'messages' &&
            change.value?.message &&
            !change.value?.message?.is_echo
          ) {
            const senderId = change.value.sender?.id;
            const text = change.value.message?.text || null;

            if (!senderId) continue;

            if (!text) {
              await sendMessage(senderId, "je peux pas écouter les vocaux, tu peux m'écrire ?", salon.metaAccessToken);
              continue;
            }

            console.log(`📩 [${salon.name}] Story reply de ${senderId}: ${text}`);
            await handleMessage(senderId, text, salon);
          }
        }
      }
    }
  } catch (err) {
    console.error('❌ WEBHOOK ERROR:', err);
  }
  res.sendStatus(200);
});

// ========================
// 🧪 TEST ENDPOINT
// ========================
app.post('/test-webhook', async (req, res) => {
  console.log('🧪 TEST WEBHOOK');
  try {
    const senderId = req.body.senderId || 'test-user';
    const text = req.body.message || 'test';
    const salonId = req.body.salonId; // passe le salonId dans le body pour tester

    const salon = getSalonByPageId(salonId);
    if (!salon) return res.status(400).json({ error: `Salon non trouvé pour salonId: ${salonId}` });

    await handleMessage(senderId, text, salon);
    res.sendStatus(200);
  } catch (err) {
    console.error('❌ TEST ERROR:', err);
    res.sendStatus(500);
  }
});

// ========================
// ❤️ HEALTH CHECK
// ========================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', bot: 'FCUTZ Multi-tenant' });
});

// ========================
// 🚀 SERVER START
// ========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('🚀 Server running on port', PORT);
});

// ================================================
// instagram.js — Multi-tenant
// Le token est passé dynamiquement selon le salon
// ================================================

const axios = require('axios');

async function sendMessage(recipientId, text, accessToken) {
  try {
    const response = await axios.post(
      'https://graph.facebook.com/v19.0/me/messages',
      {
        recipient: { id: recipientId },
        message: { text },
      },
      {
        params: {
          access_token: accessToken, // ← token dynamique selon le salon
        },
      }
    );
    console.log('📤 MESSAGE ENVOYÉ:', response.data);
  } catch (err) {
    console.error('❌ Erreur envoi message:', err.response?.data || err.message);
  }
}

module.exports = { sendMessage };

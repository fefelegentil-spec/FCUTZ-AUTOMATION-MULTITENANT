const axios = require('axios');

// Envoie un message à un utilisateur Instagram
async function sendMessage(recipientId, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${process.env.INSTAGRAM_ACCOUNT_ID}/messages`,
      {
        recipient: { id: recipientId },
        message: { text },
        messaging_type: 'RESPONSE'
      },
      {
        params: { access_token: process.env.META_ACCESS_TOKEN }
      }
    );
    console.log(`✅ Message envoyé à ${recipientId}`);
  } catch (err) {
    console.error('❌ Erreur envoi Instagram:', err.response?.data || err.message);
  }
}

module.exports = { sendMessage };

const axios = require("axios");

// Envoi via Meta Page Messaging API (stable)
async function sendMessage(recipientId, text) {
  try {
    const response = await axios.post(
      "https://graph.facebook.com/v19.0/me/messages",
      {
        recipient: { id: recipientId },
        message: { text },
      },
      {
        params: {
          access_token: process.env.META_ACCESS_TOKEN,
        },
      }
    );

    console.log("📤 MESSAGE ENVOYÉ:", response.data);
  } catch (err) {
    console.error(
      "❌ Erreur envoi message:",
      err.response?.data || err.message
    );
  }
}

module.exports = { sendMessage };

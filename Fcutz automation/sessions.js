// Stockage en mémoire des conversations par utilisateur
// Pour la production, vous pouvez remplacer par Redis ou PostgreSQL
const sessions = {};

function getHistory(userId) {
  if (!sessions[userId]) {
    sessions[userId] = { messages: [], lastActivity: Date.now() };
  }
  return sessions[userId].messages;
}

function addMessage(userId, role, content) {
  if (!sessions[userId]) {
    sessions[userId] = { messages: [], lastActivity: Date.now() };
  }
  sessions[userId].messages.push({ role, content });
  sessions[userId].lastActivity = Date.now();

  // On garde seulement les 10 derniers messages
  if (sessions[userId].messages.length > 10) {
    sessions[userId].messages = sessions[userId].messages.slice(-10);
  }
}

// Nettoyer les sessions inactives depuis plus de 30 min
function clearOldSessions() {
  const trenteMins = 30 * 60 * 1000;
  const now = Date.now();
  for (const userId in sessions) {
    if (now - sessions[userId].lastActivity > trenteMins) {
      delete sessions[userId];
      console.log(`🗑️ Session expirée pour ${userId}`);
    }
  }
}

setInterval(clearOldSessions, 10 * 60 * 1000);

module.exports = { getHistory, addMessage };

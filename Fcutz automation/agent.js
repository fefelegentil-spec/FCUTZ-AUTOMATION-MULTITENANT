// ================================================
// agent.js — Multi-tenant
// Le prompt, le token et les services sont
// chargés dynamiquement selon le salon
// ================================================

const Anthropic = require('@anthropic-ai/sdk');
const { getHistory, addMessage } = require('./sessions');
const { sendMessage } = require('./instagram');
const { getAvailableSlots, findBooking, createBooking, rescheduleBooking, cancelBooking } = require('./booking');

const tools = [
  {
    name: 'get_slots',
    description: 'Récupère les créneaux disponibles pour une date et une prestation données',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date au format YYYY-MM-DD' },
        service: { type: 'string', description: 'Nom exact de la prestation' },
      },
      required: ['date', 'service'],
    },
  },
  {
    name: 'find_booking',
    description: 'Recherche un RDV existant par prénom et date optionnelle',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Prénom du client' },
        date: { type: 'string', description: 'Date au format YYYY-MM-DD (optionnel)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'create_booking',
    description: 'Crée un rendez-vous après confirmation explicite du client',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Prénom (et nom si donné) du client' },
        service: { type: 'string', description: 'Nom exact de la prestation' },
        date: { type: 'string', description: 'Date au format YYYY-MM-DD' },
        time: { type: 'string', description: 'Heure au format HH:MM' },
      },
      required: ['name', 'service', 'date', 'time'],
    },
  },
  {
    name: 'reschedule_booking',
    description: 'Déplace un RDV existant vers un nouveau créneau après confirmation',
    input_schema: {
      type: 'object',
      properties: {
        bookingId: { type: 'string', description: 'ID du RDV à déplacer' },
        name: { type: 'string', description: 'Prénom du client' },
        service: { type: 'string', description: 'Nom exact de la prestation' },
        newDate: { type: 'string', description: 'Nouvelle date au format YYYY-MM-DD' },
        newTime: { type: 'string', description: 'Nouvelle heure au format HH:MM' },
      },
      required: ['bookingId', 'name', 'service', 'newDate', 'newTime'],
    },
  },
  {
    name: 'cancel_booking',
    description: 'Annule un rendez-vous après confirmation explicite',
    input_schema: {
      type: 'object',
      properties: {
        booking_id: { type: 'string', description: "ID du RDV" },
      },
      required: ['booking_id'],
    },
  },
];

// ---- Fonction principale — reçoit maintenant le salon en paramètre ----
async function handleMessage(senderId, userText, salon) {
  if (!userText || !salon) return;

  // Clé de session unique par client ET par salon
  const sessionKey = `${salon.name}:${senderId}`;

  addMessage(sessionKey, 'user', userText);
  const history = getHistory(sessionKey);

  // Client Anthropic initialisé avec la clé globale (une seule clé API pour toi)
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: salon.systemPrompt,   // ← prompt dynamique selon le salon
    tools,
    messages: history,
  });

  while (response.stop_reason === 'tool_use') {
    const toolUses = response.content.filter(b => b.type === 'tool_use');
    const toolResults = [];

    for (const toolUse of toolUses) {
      let result;
      console.log(`🔧 [${salon.name}] Claude utilise: ${toolUse.name}`, toolUse.input);

      if (toolUse.name === 'get_slots') {
        result = await getAvailableSlots(toolUse.input.date, toolUse.input.service, salon.bookingApiUrl, salon.services);
      } else if (toolUse.name === 'find_booking') {
        result = await findBooking({ name: toolUse.input.name, date: toolUse.input.date }, salon.bookingApiUrl);
      } else if (toolUse.name === 'create_booking') {
        result = await createBooking({ ...toolUse.input, instagramId: senderId }, salon.bookingApiUrl, salon.services);
      } else if (toolUse.name === 'reschedule_booking') {
        result = await rescheduleBooking({ ...toolUse.input, instagramId: senderId }, salon.bookingApiUrl, salon.services);
      } else if (toolUse.name === 'cancel_booking') {
        result = await cancelBooking(toolUse.input.booking_id, salon.bookingApiUrl);
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      });
    }

    history.push({ role: 'assistant', content: response.content });
    history.push({ role: 'user', content: toolResults });

    response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: salon.systemPrompt,
      tools,
      messages: history,
    });
  }

  const finalText = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  addMessage(sessionKey, 'assistant', finalText);

  // Envoie avec le token du bon salon
  await sendMessage(senderId, finalText, salon.metaAccessToken);

  console.log(`💬 [${salon.name}] Réponse envoyée à ${senderId}:`, finalText);
}

module.exports = { handleMessage };

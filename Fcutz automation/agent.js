const Anthropic = require('@anthropic-ai/sdk');
const { getHistory, addMessage } = require('./sessions');
const { sendMessage } = require('./instagram');
const { getAvailableSlots, createBooking, cancelBooking } = require('./booking');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `
Tu es l'assistant virtuel de FCUTZ, un salon de coiffure. Tu réponds aux messages Instagram des clients.
Tu es chaleureux, décontracté mais professionnel. Tu réponds toujours en français, de manière concise (max 3 phrases).
Tu comprends les messages écrits de manière informelle ("frérot dispo demain 18h", "jsuis chaud pour une coupe", etc.)

Prestations disponibles UNIQUEMENT via message privé :
- Coupe Simple via DM (30 min) → 20€
- Transformation via DM (45 min) → 25€
- Coupe Premium via DM (60 min) → 35€

Ces prestations sont exclusives aux DMs (pas disponibles sur le site).

Processus pour un RDV :
1. Si la prestation n'est pas précisée, demande laquelle parmi les 3
2. Demande la date souhaitée (si pas précisée)
3. Utilise get_slots pour vérifier les dispos
4. Propose 2-3 créneaux disponibles
5. Quand le client choisit, demande son prénom
6. Récapitule : prénom, prestation, date, heure, prix
7. Sur confirmation explicite ("oui", "ok", "c'est bon", "parfait", "go"...), utilise create_booking
8. Confirme la réservation avec un message sympa

Pour une annulation :
1. Demande le prénom et la date du RDV
2. Confirme avant d'annuler
3. Utilise cancel_booking avec l'ID

Règles importantes :
- Ne JAMAIS créer un RDV sans confirmation explicite
- Si le jour demandé est fermé, propose le prochain jour ouvert
- Si plus de créneaux dispo ce jour-là, propose un autre jour
- Si tu ne sais pas répondre, dis que tu vas transmettre au patron
- Rappelle toujours que ces tarifs sont +5€ vs le site car c'est une réservation exclusive via DM
`;

const tools = [
  {
    name: 'get_slots',
    description: 'Récupère les créneaux disponibles pour une date et une prestation données',
    input_schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Date au format YYYY-MM-DD, ex: 2026-05-20',
        },
        service: {
          type: 'string',
          description: 'Nom exact de la prestation: "Coupe Simple via DM", "Transformation via DM", ou "Coupe Premium via DM"',
        },
      },
      required: ['date', 'service'],
    },
  },
  {
    name: 'create_booking',
    description: 'Crée un rendez-vous après confirmation explicite du client',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Prénom (et nom si donné) du client',
        },
        service: {
          type: 'string',
          description: 'Nom exact de la prestation: "Coupe Simple via DM", "Transformation via DM", ou "Coupe Premium via DM"',
        },
        date: {
          type: 'string',
          description: 'Date au format YYYY-MM-DD',
        },
        time: {
          type: 'string',
          description: 'Heure au format HH:MM, ex: 14:30',
        },
      },
      required: ['name', 'service', 'date', 'time'],
    },
  },
  {
    name: 'cancel_booking',
    description: 'Annule un rendez-vous existant',
    input_schema: {
      type: 'object',
      properties: {
        booking_id: {
          type: 'string',
          description: "L'identifiant unique du rendez-vous (ex: a_mp5f38cv)",
        },
      },
      required: ['booking_id'],
    },
  },
];

async function handleMessage(senderId, userText) {
  if (!userText) return;

  addMessage(senderId, 'user', userText);
  const history = getHistory(senderId);

  let response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools,
    messages: history,
  });

  while (response.stop_reason === 'tool_use') {
    const toolUses = response.content.filter(b => b.type === 'tool_use');
    const toolResults = [];

    for (const toolUse of toolUses) {
      let result;
      console.log(`🔧 Claude utilise: ${toolUse.name}`, toolUse.input);

      if (toolUse.name === 'get_slots') {
        const slots = await getAvailableSlots(toolUse.input.date, toolUse.input.service);
        result = JSON.stringify(slots);
      } else if (toolUse.name === 'create_booking') {
        const booking = await createBooking({
          ...toolUse.input,
          instagramId: senderId,
        });
        result = JSON.stringify(booking);
      } else if (toolUse.name === 'cancel_booking') {
        const success = await cancelBooking(toolUse.input.booking_id);
        result = JSON.stringify({ success });
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result,
      });
    }

    history.push({ role: 'assistant', content: response.content });
    history.push({ role: 'user', content: toolResults });

    response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      messages: history,
    });
  }

  const finalText = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  addMessage(senderId, 'assistant', finalText);
  await sendMessage(senderId, finalText);

  console.log(`💬 Réponse envoyée à ${senderId}:`, finalText);
}

module.exports = { handleMessage };

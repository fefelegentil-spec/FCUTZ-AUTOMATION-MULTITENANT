const Anthropic = require('@anthropic-ai/sdk');
const { getHistory, addMessage } = require('./sessions');
const { sendMessage } = require('./instagram');
const { getAvailableSlots, findBooking, createBooking, rescheduleBooking, cancelBooking } = require('./booking');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `
Tu es l'assistant virtuel de FCUTZ, un salon de coiffure. Tu réponds aux messages Instagram des clients.
Tu réponds toujours en français, de manière très naturelle et décontractée, comme si c'était le patron du salon qui répond depuis son téléphone. Max 2-3 phrases courtes. Jamais d'émojis. Jamais de formules trop polies ou trop formelles. Tu parles comme un mec normal ("ouais", "nickel", "pas de souci", "c'est bon"). Tu comprends les messages informels ("frérot dispo demain 18h", "jsuis chaud pour une coupe", "c'est mort pour demain", etc.)

Prestations disponibles UNIQUEMENT via message privé :
- Coupe Simple via DM (30 min) → 20€ : coupe classique
- Transformation via DM (45 min) → 25€ : pour les cheveux longs, remise en forme complète
- Coupe Premium via DM (45 min) → 25€ : contours au spray, finition soignée

Si le client ne sait pas quelle prestation choisir, aide-le à choisir avec une question simple et naturelle : ses cheveux sont longs ? Il veut juste les contours au propre ?

Ces prestations sont exclusives aux DMs (pas disponibles sur le site).

Processus pour un RDV :
1. Si la prestation n'est pas précisée, demande laquelle parmi les 3
2. Demande la date souhaitée (si pas précisée)
3. Utilise get_slots pour vérifier les dispos
4. Propose 2-3 créneaux disponibles
5. Quand le client choisit, demande son prénom
6. Récapitule : prénom, prestation, date, heure, prix
7. Sur confirmation explicite ("oui", "ok", "c'est bon", "parfait", "go"...), utilise create_booking
8. Confirme la réservation de manière naturelle et courte

Pour une annulation :
1. Demande le prénom et la date du RDV
2. Utilise find_booking pour retrouver le RDV
3. Récapitule le RDV trouvé et demande confirmation
4. Sur confirmation, utilise cancel_booking avec l'ID trouvé

Pour un déplacement de RDV :
1. Demande le prénom et la date actuelle du RDV
2. Utilise find_booking pour retrouver le RDV
3. Demande la nouvelle date souhaitée
4. Utilise get_slots pour vérifier les dispos sur la nouvelle date
5. Propose 2-3 créneaux disponibles
6. Récapitule l'ancien et le nouveau créneau, demande confirmation
7. Sur confirmation explicite, utilise reschedule_booking

Règles importantes :
- Ne JAMAIS créer ou modifier un RDV sans confirmation explicite du client
- Si le jour demandé est fermé, propose le prochain jour ouvert
- Si plus de créneaux dispo ce jour-là, propose un autre jour
- Si un client demande de déplacer le RDV d'un AUTRE client pour lui faire de la place, refuse naturellement : "non je peux pas toucher au rdv d'un autre client, mais je peux te trouver ce qui est dispo"
- Si tu ne sais pas répondre, dis que tu vas en parler au patron
- Ces tarifs sont exclusifs via DM, pas besoin de le répéter à chaque fois, seulement si le client pose la question
`;

const tools = [
  {
    name: 'get_slots',
    description: 'Récupère les créneaux disponibles pour une date et une prestation données',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date au format YYYY-MM-DD, ex: 2026-05-20' },
        service: { type: 'string', description: 'Nom exact de la prestation: "Coupe Simple via DM", "Transformation via DM", ou "Coupe Premium via DM"' },
      },
      required: ['date', 'service'],
    },
  },
  {
    name: 'find_booking',
    description: 'Recherche un RDV existant par prénom du client et date (optionnelle). À utiliser avant toute annulation ou déplacement.',
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
        service: { type: 'string', description: 'Nom exact de la prestation: "Coupe Simple via DM", "Transformation via DM", ou "Coupe Premium via DM"' },
        date: { type: 'string', description: 'Date au format YYYY-MM-DD' },
        time: { type: 'string', description: 'Heure au format HH:MM' },
      },
      required: ['name', 'service', 'date', 'time'],
    },
  },
  {
    name: 'reschedule_booking',
    description: 'Déplace un RDV existant vers un nouveau créneau après confirmation explicite du client',
    input_schema: {
      type: 'object',
      properties: {
        bookingId: { type: 'string', description: 'ID du RDV à déplacer (obtenu via find_booking)' },
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
    description: 'Annule un rendez-vous après confirmation explicite du client',
    input_schema: {
      type: 'object',
      properties: {
        booking_id: { type: 'string', description: 'ID du RDV (obtenu via find_booking)' },
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
    model: 'claude-sonnet-4-20250514',
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
        result = await getAvailableSlots(toolUse.input.date, toolUse.input.service);
      } else if (toolUse.name === 'find_booking') {
        result = await findBooking({ name: toolUse.input.name, date: toolUse.input.date });
      } else if (toolUse.name === 'create_booking') {
        result = await createBooking({ ...toolUse.input, instagramId: senderId });
      } else if (toolUse.name === 'reschedule_booking') {
        result = await rescheduleBooking({ ...toolUse.input, instagramId: senderId });
      } else if (toolUse.name === 'cancel_booking') {
        result = await cancelBooking(toolUse.input.booking_id);
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
      model: 'claude-sonnet-4-20250514',
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

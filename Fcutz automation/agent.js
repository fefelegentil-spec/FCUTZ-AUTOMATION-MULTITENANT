const Anthropic = require('@anthropic-ai/sdk');
const { getHistory, addMessage } = require('./sessions');
const { sendMessage } = require('./instagram');
const { getAvailableSlots, createBooking, cancelBooking } = require('./booking');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 🧠 Personnalité et règles de l'agent
// Modifiez ce prompt pour adapter le nom du salon, les prestations et les horaires
const SYSTEM_PROMPT = `
Tu es l'assistant virtuel d'un salon de coiffure. Tu réponds aux messages Instagram des clients.
Tu es chaleureux, professionnel et concis (max 3 phrases par message). Tu réponds toujours en français.

Prestations disponibles :
- Coupe femme (45 min) 
- Coupe homme (30 min)
- Brushing (30 min)
- Barbe (20 min)
- Coloration (90 min)
- Mèches (120 min)

Horaires d'ouverture : Mardi au Samedi, 9h à 19h. Fermé dimanche et lundi.

Processus pour un RDV :
1. Si la prestation n'est pas précisée, demande laquelle
2. Demande la date souhaitée
3. Utilise l'outil get_slots pour vérifier les disponibilités
4. Propose 2-3 créneaux disponibles
5. Quand le client choisit un créneau, demande son prénom
6. Confirme le récapitulatif (prénom, prestation, date, heure)
7. Sur confirmation explicite ("oui", "ok", "parfait"...), utilise create_booking

Pour une annulation :
1. Demande le prénom et la date du RDV
2. Confirme avant d'annuler
3. Utilise cancel_booking

Ne crée JAMAIS un RDV sans confirmation explicite du client.
Si tu ne sais pas répondre à une question, dis que le salon sera contacté.
`;

// 🔧 Outils que Claude peut utiliser pour interagir avec votre système
const tools = [
  {
    name: 'get_slots',
    description: 'Récupère les créneaux disponibles pour une date et une prestation données',
    input_schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Date au format YYYY-MM-DD, ex: 2025-06-14'
        },
        service: {
          type: 'string',
          description: 'Nom exact de la prestation, ex: Coupe femme'
        }
      },
      required: ['date', 'service']
    }
  },
  {
    name: 'create_booking',
    description: 'Crée un rendez-vous après confirmation explicite du client',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Prénom du client'
        },
        service: {
          type: 'string',
          description: 'Nom de la prestation'
        },
        date: {
          type: 'string',
          description: 'Date au format YYYY-MM-DD'
        },
        time: {
          type: 'string',
          description: 'Heure au format HH:MM, ex: 14:30'
        }
      },
      required: ['name', 'service', 'date', 'time']
    }
  },
  {
    name: 'cancel_booking',
    description: 'Annule un rendez-vous existant',
    input_schema: {
      type: 'object',
      properties: {
        booking_id: {
          type: 'string',
          description: "L'identifiant unique du rendez-vous"
        }
      },
      required: ['booking_id']
    }
  }
];

// 🚀 Fonction principale : reçoit un message et envoie une réponse
async function handleMessage(senderId, userText) {
  // 1. Ajouter le message du client à l'historique
  addMessage(senderId, 'user', userText);
  const history = getHistory(senderId);

  // 2. Appeler Claude avec l'historique complet
  let response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools,
    messages: history
  });

  // 3. Boucle : Claude peut utiliser plusieurs outils à la suite
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
          instagramId: senderId
        });
        result = JSON.stringify(booking);
      } else if (toolUse.name === 'cancel_booking') {
        const success = await cancelBooking(toolUse.input.booking_id);
        result = JSON.stringify({ success });
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result
      });
    }

    // Donner les résultats à Claude et le laisser continuer
    history.push({ role: 'assistant', content: response.content });
    history.push({ role: 'user', content: toolResults });

    response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      messages: history
    });
  }

  // 4. Extraire la réponse texte finale
  const finalText = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  // 5. Sauvegarder la réponse et l'envoyer sur Instagram
  addMessage(senderId, 'assistant', finalText);
  await sendMessage(senderId, finalText);
}

module.exports = { handleMessage };

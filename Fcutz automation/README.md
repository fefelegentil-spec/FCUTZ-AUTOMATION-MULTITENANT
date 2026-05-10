# 🤖 BarberBot — Agent IA Instagram pour salon de coiffure

Agent IA qui gère automatiquement les demandes de rendez-vous reçues en message privé Instagram.

## Fonctionnalités

- ✅ Répond automatiquement aux DMs Instagram
- 📅 Vérifie les disponibilités sur votre site de réservation
- 🗓️ Crée des rendez-vous après confirmation client
- ❌ Gère les annulations
- 🧠 Maintient le contexte de la conversation

## Stack technique

- **Runtime** : Node.js
- **Framework** : Express.js
- **IA** : Claude (Anthropic API) avec tool use
- **Messagerie** : Instagram Graph API (Meta)
- **Hébergement** : Railway / Render

## Installation

1. Cloner le repo
```bash
git clone https://github.com/votre-user/barberbot.git
cd barberbot
npm install
```

2. Copier et remplir les variables d'environnement
```bash
cp .env.example .env
# Éditez .env avec vos vraies clés
```

3. Lancer en local
```bash
npm start
```

## Variables d'environnement

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Clé API Anthropic (claude.ai) |
| `META_ACCESS_TOKEN` | Token d'accès Meta/Instagram |
| `INSTAGRAM_ACCOUNT_ID` | ID de votre compte Instagram Pro |
| `VERIFY_TOKEN` | Token de vérification webhook (inventez-le) |
| `BOOKING_API_URL` | URL de base de votre API de réservation |

## Structure du projet

```
barberbot/
├── index.js       # Serveur Express + webhook
├── agent.js       # Logique agent IA (Claude)
├── instagram.js   # Envoi de messages Instagram
├── booking.js     # Connexion à votre site de réservation
├── sessions.js    # Mémoire des conversations
└── .env.example   # Modèle de configuration
```

## Déploiement sur Railway

1. Pusher ce repo sur GitHub
2. Sur railway.app → New Project → Deploy from GitHub
3. Ajouter les variables d'environnement dans Railway
4. Récupérer l'URL publique et l'enregistrer comme webhook sur Meta

## Adapter à votre site de réservation

Modifiez `booking.js` pour correspondre aux routes de votre API :
- `GET /slots?date=YYYY-MM-DD&service=...` → créneaux disponibles
- `POST /bookings` → créer un RDV
- `DELETE /bookings/:id` → annuler un RDV

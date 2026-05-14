const axios = require('axios');
const BASE = process.env.BOOKING_API_URL; // https://fcutz-backend-production.up.railway.app/api

// ========================
// 📋 PRESTATIONS VIA DM
// ========================
const SERVICES_VIA_DM = {
  'Coupe Simple via DM': { duration: 30, price: 20 },
  'Transformation via DM': { duration: 45, price: 25 },
  'Coupe Premium via DM': { duration: 60, price: 35 },
};

// ========================
// 🕐 UTILITAIRES HORAIRES
// ========================
const DAY_MAP = {
  0: 'dim',
  1: 'lun',
  2: 'mar',
  3: 'mer',
  4: 'jeu',
  5: 'ven',
  6: 'sam',
};

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

// ========================
// 📅 CRÉNEAUX DISPONIBLES
// ========================
async function getAvailableSlots(date, service) {
  try {
    const serviceInfo = SERVICES_VIA_DM[service];
    if (!serviceInfo) {
      return { error: `Prestation inconnue: ${service}` };
    }
    const duration = serviceInfo.duration;

    // 1. Récupérer les horaires d'ouverture
    const availRes = await axios.get(`${BASE}/availability`);
    const hours = availRes.data.hours;
    const closedDates = availRes.data.closedDates || [];

    // 2. Vérifier si la date est fermée
    if (closedDates.includes(date)) {
      return { available: false, reason: 'Fermé ce jour-là', slots: [] };
    }

    // 3. Vérifier si le jour est ouvert
    const dayOfWeek = new Date(date).getDay();
    const dayKey = DAY_MAP[dayOfWeek];
    const dayHours = hours[dayKey];

    if (!dayHours || !dayHours.open) {
      return { available: false, reason: 'Fermé ce jour-là', slots: [] };
    }

    const openMinutes = timeToMinutes(dayHours.start);
    const closeMinutes = timeToMinutes(dayHours.end);

    // 4. Récupérer les RDV existants ce jour-là
    const apptRes = await axios.get(`${BASE}/appointments`);
    const allAppointments = apptRes.data || [];
    const dayAppointments = allAppointments.filter(a => a.date === date && a.status !== 'cancelled');

    // 5. Calculer les créneaux occupés
    const busySlots = dayAppointments.map(a => ({
      start: timeToMinutes(a.time),
      end: timeToMinutes(a.time) + (a.duration || 30),
    }));

    // 6. Générer les créneaux libres (toutes les 15 min)
    const freeSlots = [];
    for (let t = openMinutes; t + duration <= closeMinutes; t += 15) {
      const slotEnd = t + duration;
      const isBusy = busySlots.some(b => t < b.end && slotEnd > b.start);
      if (!isBusy) {
        freeSlots.push(minutesToTime(t));
      }
    }

    return {
      available: freeSlots.length > 0,
      date,
      service,
      duration,
      price: serviceInfo.price,
      slots: freeSlots,
    };
  } catch (err) {
    console.error('❌ Erreur créneaux:', err.message);
    return { error: 'Impossible de récupérer les créneaux', slots: [] };
  }
}

// ========================
// ✅ CRÉER UN RDV
// ========================
async function createBooking({ name, service, date, time, instagramId }) {
  try {
    const serviceInfo = SERVICES_VIA_DM[service];
    if (!serviceInfo) {
      return { error: `Prestation inconnue: ${service}` };
    }

    // Séparer prénom / nom (on met tout en fname si un seul mot)
    const parts = name.trim().split(' ');
    const fname = parts[0];
    const lname = parts.slice(1).join(' ') || '';

    const response = await axios.post(`${BASE}/book`, {
      fname,
      lname,
      phone: '',
      email: '',
      note: `Réservation via Instagram DM (@${instagramId})`,
      service,
      date,
      time,
      duration: serviceInfo.duration,
      price: serviceInfo.price,
      source: 'instagram',
    });

    return response.data;
  } catch (err) {
    console.error('❌ Erreur création RDV:', err.message);
    return { error: 'Impossible de créer le rendez-vous' };
  }
}

// ========================
// ❌ ANNULER UN RDV
// ========================
async function cancelBooking(bookingId) {
  try {
    await axios.delete(`${BASE}/appointments/${bookingId}`);
    return true;
  } catch (err) {
    console.error('❌ Erreur annulation:', err.message);
    return false;
  }
}

module.exports = { getAvailableSlots, createBooking, cancelBooking, SERVICES_VIA_DM };

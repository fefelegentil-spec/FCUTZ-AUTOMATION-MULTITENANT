const axios = require('axios');
const BASE = process.env.BOOKING_API_URL;

const SERVICES_VIA_DM = {
  'Coupe Simple via DM': { duration: 30, price: 20 },
  'Transformation via DM': { duration: 45, price: 25 },
  'Coupe Premium via DM': { duration: 45, price: 25 },
};

const DAY_MAP = { 0:'dim', 1:'lun', 2:'mar', 3:'mer', 4:'jeu', 5:'ven', 6:'sam' };

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

async function getAvailableSlots(date, service) {
  try {
    const serviceInfo = SERVICES_VIA_DM[service];
    if (!serviceInfo) return { error: `Prestation inconnue: ${service}` };
    const duration = serviceInfo.duration;

    const availRes = await axios.get(`${BASE}/availability`);
    const hours = availRes.data.hours;
    const closedDates = availRes.data.closedDates || [];

    if (closedDates.includes(date)) return { available: false, reason: 'Fermé ce jour-là', slots: [] };

    const dayOfWeek = new Date(date).getDay();
    const dayKey = DAY_MAP[dayOfWeek];
    const dayHours = hours[dayKey];

    if (!dayHours || !dayHours.open) return { available: false, reason: 'Fermé ce jour-là', slots: [] };

    const openMinutes = timeToMinutes(dayHours.start);
    const closeMinutes = timeToMinutes(dayHours.end);

    const apptRes = await axios.get(`${BASE}/appointments`);
    const allAppointments = apptRes.data || [];
    const dayAppointments = allAppointments.filter(a => a.date === date && a.status !== 'cancelled');

    const busySlots = dayAppointments.map(a => ({
      start: timeToMinutes(a.time),
      end: timeToMinutes(a.time) + (a.duration || 30),
    }));

    const freeSlots = [];
    for (let t = openMinutes; t + duration <= closeMinutes; t += 15) {
      const slotEnd = t + duration;
      const isBusy = busySlots.some(b => t < b.end && slotEnd > b.start);
      if (!isBusy) freeSlots.push(minutesToTime(t));
    }

    return { available: freeSlots.length > 0, date, service, duration, price: serviceInfo.price, slots: freeSlots };
  } catch (err) {
    console.error('❌ Erreur créneaux:', err.message);
    return { error: 'Impossible de récupérer les créneaux', slots: [] };
  }
}

async function findBooking({ name, date }) {
  try {
    const apptRes = await axios.get(`${BASE}/appointments`);
    const all = apptRes.data || [];
    const firstNameLower = name.trim().split(' ')[0].toLowerCase();
    const matches = all.filter(a => {
      const sameName = a.fname?.toLowerCase() === firstNameLower ||
                       a.name?.toLowerCase().includes(firstNameLower);
      const sameDate = date ? a.date === date : true;
      return sameName && sameDate && a.status !== 'cancelled';
    });
    if (matches.length === 0) return { found: false, message: 'Aucun RDV trouvé' };
    return { found: true, bookings: matches.map(a => ({
      id: a._id || a.id,
      date: a.date,
      time: a.time,
      service: a.service,
      fname: a.fname,
    }))};
  } catch (err) {
    console.error('❌ Erreur recherche RDV:', err.message);
    return { error: 'Impossible de rechercher le RDV' };
  }
}

async function createBooking({ name, service, date, time, instagramId }) {
  try {
    const serviceInfo = SERVICES_VIA_DM[service];
    if (!serviceInfo) return { error: `Prestation inconnue: ${service}` };
    const parts = name.trim().split(' ');
    const fname = parts[0];
    const lname = parts.slice(1).join(' ') || '';
    const response = await axios.post(`${BASE}/book`, {
      fname, lname,
      phone: '', email: '',
      note: `Réservation via Instagram DM (@${instagramId})`,
      service, date, time,
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

async function rescheduleBooking({ bookingId, name, service, newDate, newTime, instagramId }) {
  try {
    await axios.delete(`${BASE}/appointments/${bookingId}`);
    const newBooking = await createBooking({ name, service, date: newDate, time: newTime, instagramId });
    return { success: true, newBooking };
  } catch (err) {
    console.error('❌ Erreur déplacement RDV:', err.message);
    return { error: 'Impossible de déplacer le rendez-vous' };
  }
}

async function cancelBooking(bookingId) {
  try {
    await axios.delete(`${BASE}/appointments/${bookingId}`);
    return true;
  } catch (err) {
    console.error('❌ Erreur annulation:', err.message);
    return false;
  }
}

module.exports = { getAvailableSlots, findBooking, createBooking, rescheduleBooking, cancelBooking, SERVICES_VIA_DM };

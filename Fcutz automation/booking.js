const axios = require('axios');
const BASE = process.env.BOOKING_API_URL;

// Récupère les créneaux disponibles
// Adaptez les URLs et paramètres à votre site maison
async function getAvailableSlots(date, service) {
  try {
    const response = await axios.get(`${BASE}/slots`, {
      params: { date, service }
    });
    return response.data;
    // Format attendu : [{ time: "10:00", available: true }, ...]
  } catch (err) {
    console.error('❌ Erreur créneaux:', err.message);
    return [];
  }
}

// Crée un rendez-vous
async function createBooking({ name, service, date, time, instagramId }) {
  try {
    const response = await axios.post(`${BASE}/bookings`, {
      name,
      service,
      date,
      time,
      contact: instagramId,
      source: 'instagram'
    });
    return response.data;
    // Format attendu : { id: "abc123", confirmationMessage: "..." }
  } catch (err) {
    console.error('❌ Erreur création RDV:', err.message);
    return null;
  }
}

// Annule un rendez-vous
async function cancelBooking(bookingId) {
  try {
    await axios.delete(`${BASE}/bookings/${bookingId}`);
    return true;
  } catch (err) {
    console.error('❌ Erreur annulation:', err.message);
    return false;
  }
}

module.exports = { getAvailableSlots, createBooking, cancelBooking };

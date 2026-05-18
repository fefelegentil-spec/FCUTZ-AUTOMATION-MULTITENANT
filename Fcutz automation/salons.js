// ================================================
// salons.js — Multi-tenant via Supabase
// ================================================
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function getSalonByPageId(pageId) {
  const { data, error } = await supabase
    .from('salons')
    .select('*')
    .eq('page_id', pageId)
    .eq('active', true)
    .single();

  if (error || !data) {
    console.warn(`⚠️ Salon non trouvé pour pageId: ${pageId}`);
    return null;
  }

  return {
    name: data.name,
    metaAccessToken: data.meta_access_token,
    bookingApiUrl: data.booking_api_url,
    systemPrompt: data.system_prompt,
    services: data.services,
  };
}

module.exports = { getSalonByPageId };

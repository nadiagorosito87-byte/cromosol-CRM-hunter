// netlify/functions/get-leads.js
// Sin dependencias externas — usa fetch nativo de Node 18+

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Variables de entorno no configuradas' }) };
  }

  try {
    const params = event.queryStringParameters || {};
    const limit  = parseInt(params.limit  || '100');
    const offset = parseInt(params.offset || '0');

    let url = `${SUPABASE_URL}/rest/v1/leads?select=*&order=created_at.desc&limit=${limit}&offset=${offset}`;

    if (params.estado)        url += `&estado=eq.${encodeURIComponent(params.estado)}`;
    if (params.hunter_id)     url += `&hunter_id=eq.${encodeURIComponent(params.hunter_id)}`;
    if (params.sin_gestionar === 'true') url += `&estado=eq.Sin%20gestionar`;
    if (params.nuevos === '1') url += `&estado=eq.Sin%20gestionar`;

    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Range': `${offset}-${offset + limit - 1}`
      }
    });

    const data = await res.json();

    if (!res.ok) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error al consultar', detail: data }) };
    }

    const leads = (data || []).map(lead => ({
      ...lead,
      historial: (() => { try { return JSON.parse(lead.historial || '[]'); } catch { return []; } })(),
      seg_venta:  lead.seg_venta  ? lead.seg_venta.split(', ').filter(Boolean)  : [],
      seg_marcas: lead.seg_marcas ? lead.seg_marcas.split(', ').filter(Boolean) : [],
    }));

    const stats = {
      total:         leads.length,
      sin_gestionar: leads.filter(l => l.estado === 'Sin gestionar').length,
      nuevos_hoy:    leads.filter(l => l.created_at?.startsWith(new Date().toISOString().split('T')[0])).length,
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, leads, stats, total: leads.length })
    };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error interno', detail: err.message }) };
  }
};

// netlify/functions/create-lead.js
// Sin dependencias externas — usa fetch nativo de Node 18+

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Variables de entorno no configuradas' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    if (!body.nombre && !body.telefono) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Se requiere nombre o teléfono' }) };
    }

    const cuitClean = (body.cuit || '').replace(/-/g, '');
    const hoy = new Date().toISOString().split('T')[0];

    const lead = {
      nombre:          body.nombre || '',
      cuit:            body.cuit || '',
      cuit_clean:      cuitClean,
      telefono:        body.telefono || body.wp || '',
      wp:              body.wp || body.telefono || '',
      email:           body.email || '',
      rubro:           body.rubro || '',
      contacto:        body.contacto || '',
      obs:             body.obs || body.observaciones || body.mensaje_original || '',
      estado:          'Sin gestionar',
      campana:         body.campana || body.utm_campaign || 'Sin campaña',
      fuente:          body.fuente || body.utm_source || 'landing',
      origen:          body.origen || 'landing',
      zona_label:      body.zona || '',
      hunter_id:       body.hunter_id || '',
      hunter_nombre:   body.hunter_nombre || '',
      seg_tipo:        body.seg_tipo || '',
      seg_venta:       Array.isArray(body.seg_venta) ? body.seg_venta.join(', ') : (body.seg_venta || ''),
      seg_marcas:      Array.isArray(body.seg_marcas) ? body.seg_marcas.join(', ') : (body.seg_marcas || ''),
      seg_volumen:     body.seg_volumen || '',
      seg_potencial:   body.seg_potencial || '',
      seg_tamano:      body.seg_tamano || '',
      proyeccion:      body.proyeccion || '',
      utm_source:      body.utm_source || '',
      utm_medium:      body.utm_medium || '',
      utm_campaign:    body.utm_campaign || '',
      fecha_contacto:  hoy,
      fecha_alta:      '',
      fecha_traspaso:  '',
      historial:       JSON.stringify([{
        a: 'Lead creado',
        d: `Fuente: ${body.fuente || body.utm_source || 'landing'} | Campaña: ${body.campana || body.utm_campaign || '—'}`,
        f: hoy
      }])
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(lead)
    });

    const data = await res.json();

    if (!res.ok) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error al guardar', detail: data }) };
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ success: true, message: 'Lead creado', lead_id: data[0]?.id, nombre: data[0]?.nombre })
    };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error interno', detail: err.message }) };
  }
};

// netlify/functions/create-lead.js
// Recibe leads desde formularios de landing page o webhooks externos
// y los guarda en Supabase

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  // CORS headers — necesarios para que el CRM pueda llamar esta función
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');

    // Validaciones mínimas
    if (!body.nombre && !body.telefono) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Se requiere al menos nombre o teléfono' })
      };
    }

    // Normalizar CUIT — quitar guiones para comparación
    const cuitClean = (body.cuit || '').replace(/-/g, '');

    // Verificar duplicado por CUIT o teléfono
    if (cuitClean) {
      const { data: existing } = await supabase
        .from('leads')
        .select('id, nombre')
        .eq('cuit_clean', cuitClean)
        .limit(1);

      if (existing && existing.length > 0) {
        return {
          statusCode: 409,
          headers,
          body: JSON.stringify({
            error: 'Duplicado',
            message: `Ya existe un lead con ese CUIT: ${existing[0].nombre}`,
            existing_id: existing[0].id
          })
        };
      }
    }

    // Construir objeto lead
    const lead = {
      // Datos básicos
      nombre:         body.nombre || '',
      cuit:           body.cuit || '',
      cuit_clean:     cuitClean,
      telefono:       body.telefono || body.wp || '',
      email:          body.email || '',
      rubro:          body.rubro || '',
      contacto:       body.contacto || '',
      dir_entrega:    body.dir_entrega || body.direccion || '',
      dir_factu:      body.dir_factu || '',

      // Pipeline
      estado:         'Sin gestionar',
      campana:        body.campana || body.utm_campaign || 'Sin campaña',
      fuente:         body.fuente || body.utm_source || 'Landing page',
      zona_id:        body.zona_id || null,
      zona_label:     body.zona || '',
      hunter_id:      body.hunter_id || null,
      activador_id:   null,
      motivo_perdida: '',
      monto:          0,
      capacitaciones: 0,

      // Segmentación (si viene del formulario de alta)
      seg_tipo:       body.seg_tipo || body.tipo_comercio || '',
      seg_venta:      Array.isArray(body.seg_venta) ? body.seg_venta.join(', ') : (body.seg_venta || ''),
      seg_marcas:     Array.isArray(body.seg_marcas) ? body.seg_marcas.join(', ') : (body.seg_marcas || ''),
      seg_volumen:    body.seg_volumen || body.volumen || '',
      seg_potencial:  body.seg_potencial || body.potencial || '',
      seg_tamano:     body.seg_tamano || body.tamano || '',
      proyeccion:     body.proyeccion || '',
      observaciones:  body.observaciones || body.obs || body.mensaje_original || '',

      // Metadatos
      fecha_contacto: new Date().toISOString().split('T')[0],
      fecha_alta:     '',
      fecha_traspaso: '',
      origen:         body.origen || 'landing',  // 'landing' | 'whatsapp_manual' | 'importacion'
      utm_source:     body.utm_source || '',
      utm_medium:     body.utm_medium || '',
      utm_campaign:   body.utm_campaign || '',
      ip_origen:      event.headers['x-forwarded-for'] || '',
      created_at:     new Date().toISOString(),

      // Historial como JSON array
      historial: JSON.stringify([{
        accion: 'Lead creado',
        detalle: `Fuente: ${body.fuente || body.utm_source || 'Landing page'} | Campaña: ${body.campana || body.utm_campaign || '—'}`,
        fecha: new Date().toISOString().split('T')[0]
      }])
    };

    // Insertar en Supabase
    const { data, error } = await supabase
      .from('leads')
      .insert([lead])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Error al guardar en base de datos', detail: error.message })
      };
    }

    // Respuesta exitosa
    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Lead creado correctamente',
        lead_id: data.id,
        nombre: data.nombre
      })
    };

  } catch (err) {
    console.error('Error inesperado:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error interno del servidor', detail: err.message })
    };
  }
};

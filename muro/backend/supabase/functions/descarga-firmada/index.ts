// Supabase Edge Function · descarga-firmada
// POST { fondo_id } con el JWT del usuario en "Authorization: Bearer …".
// Devuelve una URL firmada de corta duración al original SOLO si tiene_derecho() lo permite.
// Estado: escrita, sin desplegar ni probar contra un proyecto Supabase real.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ORIGENES = (Deno.env.get('ORIGENES_PERMITIDOS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const VIGENCIA_S = 300;

function cabeceras(origen: string): HeadersInit {
  const permitido = ORIGENES.includes(origen) ? origen : ORIGENES[0] ?? '';
  return {
    'content-type': 'application/json',
    'access-control-allow-origin': permitido,
    'access-control-allow-headers': 'authorization, content-type, apikey',
    'access-control-allow-methods': 'POST, OPTIONS',
    vary: 'origin',
  };
}

Deno.serve(async (req) => {
  const h = cabeceras(req.headers.get('origin') ?? '');
  const responder = (cuerpo: unknown, estado = 200) => new Response(JSON.stringify(cuerpo), { status: estado, headers: h });
  if (req.method === 'OPTIONS') return new Response(null, { headers: h });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);

  const { fondo_id } = await req.json().catch(() => ({}));
  if (typeof fondo_id !== 'string' || !/^[a-z0-9-]{1,64}$/.test(fondo_id)) {
    return responder({ error: 'fondo_id no válido' }, 400);
  }

  // Cliente con la identidad del usuario: tiene_derecho() evalúa auth.uid() en la base de datos.
  const comoUsuario = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
  const { data: permitido, error } = await comoUsuario.rpc('tiene_derecho', { p_fondo: fondo_id });
  if (error) return responder({ error: 'No se pudo comprobar el acceso' }, 500);
  if (!permitido) return responder({ error: 'Sin acceso a este fondo' }, 403);

  // Con service_role: leer la ruta privada, firmar la URL y registrar la descarga.
  const servicio = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: fondo, error: e1 } = await servicio.from('fondos').select('ruta_original').eq('id', fondo_id).single();
  if (e1 || !fondo) return responder({ error: 'Fondo no encontrado' }, 404);

  const { data: firmada, error: e2 } = await servicio.storage
    .from('originales')
    .createSignedUrl(fondo.ruta_original, VIGENCIA_S, { download: `muro-${fondo_id}.webp` });
  if (e2 || !firmada) return responder({ error: 'No se pudo preparar la descarga' }, 500);

  const { data: usuario } = await comoUsuario.auth.getUser();
  await servicio.from('descargas').insert({ usuario_id: usuario.user?.id ?? null, fondo_id });
  return responder({ url: firmada.signedUrl, caduca_en_s: VIGENCIA_S });
});

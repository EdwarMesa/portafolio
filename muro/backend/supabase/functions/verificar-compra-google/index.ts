// Supabase Edge Function · verificar-compra-google
// La app Android llama aquí tras un flujo de Google Play Billing:
//   POST { tipo: 'producto' | 'suscripcion', producto_id, purchase_token }  (+ JWT del usuario)
// Se verifica el token con la Google Play Developer API, se comprueba que pertenece a este usuario
// (obfuscatedExternalAccountId = id de Supabase, fijado por la app al lanzar la compra), se registra
// la compra de forma idempotente y se confirma (acknowledge) para que Google no la reembolse.
// Estado: escrita, sin desplegar ni probar (requiere credenciales de Google Play; ver backend/README.md).
// Pendiente: endpoint de notificaciones en tiempo real (RTDN) para reembolsos y renovaciones.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PAQUETE = Deno.env.get('GOOGLE_PLAY_PAQUETE') ?? 'com.edwarmesa.muro';
const CUENTA = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON') ?? '{}');
const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PAQUETE}/purchases`;

const responder = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'content-type': 'application/json' } });

/** Token OAuth de la cuenta de servicio (JWT RS256 firmado con Web Crypto). */
async function tokenGoogle(): Promise<string> {
  const b64 = (d: string | ArrayBuffer) =>
    btoa(typeof d === 'string' ? d : String.fromCharCode(...new Uint8Array(d)))
      .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const ahora = Math.floor(Date.now() / 1000);
  const cabecera = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const carga = b64(JSON.stringify({
    iss: CUENTA.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token', iat: ahora, exp: ahora + 3600,
  }));
  const pem = CUENTA.private_key.replace(/-----[^-]+-----|\s/g, '');
  const clave = await crypto.subtle.importKey(
    'pkcs8', Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const firma = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', clave, new TextEncoder().encode(`${cabecera}.${carga}`));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${cabecera}.${carga}.${b64(firma)}`,
    }),
  });
  if (!res.ok) throw new Error(`OAuth Google: ${res.status}`);
  return (await res.json()).access_token;
}

async function google(ruta: string, token: string, metodo = 'GET') {
  const res = await fetch(`${API}/${ruta}`, { method: metodo, headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Play API ${res.status}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}

const ESTADO_SUSCRIPCION: Record<string, string> = {
  SUBSCRIPTION_STATE_ACTIVE: 'activa', SUBSCRIPTION_STATE_IN_GRACE_PERIOD: 'en_gracia',
  SUBSCRIPTION_STATE_ON_HOLD: 'en_espera', SUBSCRIPTION_STATE_PAUSED: 'en_espera',
  SUBSCRIPTION_STATE_CANCELED: 'cancelada', SUBSCRIPTION_STATE_EXPIRED: 'expirada',
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);
  const { tipo, producto_id, purchase_token } = await req.json().catch(() => ({}));
  if (!['producto', 'suscripcion'].includes(tipo) || typeof producto_id !== 'string' || typeof purchase_token !== 'string') {
    return responder({ error: 'Petición no válida' }, 400);
  }

  const comoUsuario = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false },
  });
  const { data: sesion } = await comoUsuario.auth.getUser();
  const usuario = sesion.user;
  if (!usuario) return responder({ error: 'Inicia sesión para comprar' }, 401);

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Un token ya registrado nunca cambia de dueño (evita que otra cuenta reutilice un token filtrado).
  const tabla = tipo === 'producto' ? 'compras' : 'suscripciones';
  const { data: previo } = await db.from(tabla).select('usuario_id').eq('referencia_proveedor', purchase_token).maybeSingle();
  if (previo && previo.usuario_id !== usuario.id) return responder({ error: 'La compra pertenece a otra cuenta' }, 403);

  const token = await tokenGoogle();
  const ruta = (r: string) => `${r}/${encodeURIComponent(producto_id)}/tokens/${encodeURIComponent(purchase_token)}`;

  if (tipo === 'producto') {
    // ¿Qué desbloquea este producto? Un fondo o una colección del catálogo.
    const [{ data: fondo }, { data: coleccion }] = await Promise.all([
      db.from('fondos').select('id, precio_centimos, moneda').eq('producto_id', producto_id).maybeSingle(),
      db.from('colecciones').select('id, precio_centimos, moneda').eq('producto_id', producto_id).maybeSingle(),
    ]);
    const objetivo = fondo ?? coleccion;
    if (!objetivo) return responder({ error: 'Producto desconocido' }, 404);

    const compra = await google(ruta('products'), token);
    if (compra.obfuscatedExternalAccountId && compra.obfuscatedExternalAccountId !== usuario.id) {
      return responder({ error: 'La compra pertenece a otra cuenta' }, 403);
    }
    const estado = { 0: 'completada', 1: 'cancelada', 2: 'pendiente' }[compra.purchaseState as 0 | 1 | 2] ?? 'fallida';
    const { error } = await db.from('compras').upsert({
      usuario_id: usuario.id, tipo: fondo ? 'fondo' : 'coleccion', objetivo_id: objetivo.id,
      proveedor: 'google_play', referencia_proveedor: purchase_token,
      importe_centimos: objetivo.precio_centimos ?? 0, moneda: objetivo.moneda, estado,
    }, { onConflict: 'referencia_proveedor' });
    if (error) return responder({ error: 'No se pudo registrar la compra' }, 500);
    if (estado === 'completada' && compra.acknowledgementState === 0) {
      await google(`${ruta('products')}:acknowledge`, token, 'POST');
    }
    return responder({ estado, objetivo: objetivo.id });
  }

  // Suscripción (API v2)
  const sub = await google(`subscriptionsv2/tokens/${encodeURIComponent(purchase_token)}`, token);
  const idCuenta = sub.externalAccountIdentifiers?.obfuscatedExternalAccountId;
  if (idCuenta && idCuenta !== usuario.id) return responder({ error: 'La suscripción pertenece a otra cuenta' }, 403);
  const linea = sub.lineItems?.[0];
  const estado = ESTADO_SUSCRIPCION[sub.subscriptionState] ?? 'expirada';
  const { error } = await db.from('suscripciones').upsert({
    usuario_id: usuario.id, producto_id, proveedor: 'google_play', referencia_proveedor: purchase_token,
    estado, vence_en: linea?.expiryTime ?? new Date().toISOString(),
    renovacion_automatica: Boolean(linea?.autoRenewingPlan?.autoRenewEnabled),
  }, { onConflict: 'referencia_proveedor' });
  if (error) return responder({ error: 'No se pudo registrar la suscripción' }, 500);
  if (sub.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING' && estado === 'activa') {
    await google(`subscriptions/${encodeURIComponent(producto_id)}/tokens/${encodeURIComponent(purchase_token)}:acknowledge`, token, 'POST');
  }
  return responder({ estado, vence_en: linea?.expiryTime });
});

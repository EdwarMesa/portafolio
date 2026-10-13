// Configuración pública del cliente. Aquí NO van claves privadas: la clave anon de
// Supabase es pública por diseño y la seguridad la imponen las políticas RLS del servidor.
export const CONFIG = {
  catalogo: '../catalogo/v2/',
  // Rellenar al conectar el backend (ver muro/backend/README.md). Con null la web
  // funciona en modo demostración: sin cuentas, sin pagos y sin descargas prémium.
  supabaseUrl: null,
  supabaseAnonKey: null,
};

export const MODO_DEMO = !CONFIG.supabaseUrl;

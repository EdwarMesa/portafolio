# Backend de Muro (Supabase)

| Pieza | Archivo | Estado |
|---|---|---|
| Esquema, funciones de acceso, RLS y auditoría | `supabase/migrations/0001_esquema.sql` | **Validado** en PostgreSQL 16 local (23 comprobaciones) |
| Buckets y políticas de Storage | `supabase/migrations/0002_almacenamiento.sql` | Escrito; necesita el esquema `storage` de Supabase para probarse |
| Descarga con URL firmada | `supabase/functions/descarga-firmada` | Escrito, sintaxis verificada; sin desplegar |
| Verificación de compras de Google Play | `supabase/functions/verificar-compra-google` | Escrito, sintaxis verificada; sin probar contra Google |
| Notificaciones de Google Play (reembolsos, renovaciones) | — | Pendiente |
| Pagos web con Stripe | — | Pendiente |

## Puesta en marcha

1. Crea un proyecto en [Supabase](https://supabase.com) e instala la CLI.
2. `supabase link --project-ref <ref>` y `supabase db push` (aplica las migraciones).
3. Sube las vistas previas al bucket `vistas` y los originales al bucket `originales`.
   El generador deja los originales de pago en `muro/herramientas/salida-privada/` (fuera de git).
4. Define los secretos y despliega las funciones:
   ```sh
   supabase secrets set ORIGENES_PERMITIDOS=https://edwarmesa.github.io \
     GOOGLE_PLAY_PAQUETE=com.edwarmesa.muro \
     GOOGLE_SERVICE_ACCOUNT_JSON="$(cat cuenta-servicio.json)"
   supabase functions deploy descarga-firmada
   supabase functions deploy verificar-compra-google
   ```
5. En la web, rellena `supabaseUrl` y `supabaseAnonKey` en `web/js/config.js` e implementa el
   proveedor real en `web/js/comercio.js` (mismo contrato que `ProveedorNoDisponible`).

## Variables de entorno

| Variable | Dónde | Pública | Uso |
|---|---|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Cliente y funciones | Sí (la protección la dan las RLS) | Conexión |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo funciones (Supabase la inyecta) | **No** | Escribir compras, firmar URLs |
| `ORIGENES_PERMITIDOS` | Funciones | — | CORS de `descarga-firmada` |
| `GOOGLE_PLAY_PAQUETE` | Funciones | — | Paquete de la app |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Funciones | **No** | Cuenta de servicio con permiso de "Ver datos financieros" en Play Console |

Nunca pongas la clave `service_role` ni la cuenta de servicio en el cliente o en git.

## Requisitos para la app Android

- Al lanzar la compra, `BillingFlowParams.setObfuscatedAccountId(<id de usuario de Supabase>)`:
  la función rechaza tokens que pertenezcan a otra cuenta.
- Tras cada compra, enviar `purchaseToken` a `verificar-compra-google` y solo entonces desbloquear.
- "Restaurar compras" = `queryPurchasesAsync` + reenviar cada token a la misma función.

## Probar las políticas en local

```sh
bash muro/backend/supabase/pruebas/ejecutar.sh   # necesita initdb/pg_ctl de PostgreSQL 15+
```
`pruebas/00_stubs_supabase.sql` imita lo mínimo de Supabase (roles, `auth.uid()`); no se aplica en producción.

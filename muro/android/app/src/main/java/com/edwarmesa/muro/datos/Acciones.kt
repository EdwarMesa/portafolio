package com.edwarmesa.muro.datos

import android.app.WallpaperManager
import android.content.ContentValues
import android.content.Context
import android.os.Environment
import android.provider.MediaStore
import coil3.SingletonImageLoader
import coil3.request.ImageRequest
import coil3.request.SuccessResult
import coil3.request.allowHardware
import coil3.toBitmap
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException

enum class Destino(val banderas: Int) {
    INICIO(WallpaperManager.FLAG_SYSTEM),
    BLOQUEO(WallpaperManager.FLAG_LOCK),
    AMBAS(WallpaperManager.FLAG_SYSTEM or WallpaperManager.FLAG_LOCK),
}

/** Aplica el fondo en alta resolución (reutiliza la caché de Coil si ya se vio). */
suspend fun aplicarFondo(context: Context, fondo: Fondo, destino: Destino) {
    val peticion = ImageRequest.Builder(context)
        .data(fondo.imagen)
        .allowHardware(false) // WallpaperManager necesita un bitmap de software
        .build()
    val resultado = SingletonImageLoader.get(context).execute(peticion)
    val bitmap = (resultado as? SuccessResult)?.image?.toBitmap()
        ?: throw IOException("No se pudo cargar ${fondo.imagen}")
    withContext(Dispatchers.IO) {
        WallpaperManager.getInstance(context).setBitmap(bitmap, null, true, destino.banderas)
    }
}

/** Guarda el original en Imágenes/Muro. Con MediaStore no hace falta pedir permisos (API 29+). */
suspend fun descargarFondo(context: Context, fondo: Fondo) = withContext(Dispatchers.IO) {
    val resolver = context.contentResolver
    val valores = ContentValues().apply {
        put(MediaStore.Images.Media.DISPLAY_NAME, "muro-${fondo.id}.webp")
        put(MediaStore.Images.Media.MIME_TYPE, "image/webp")
        put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Muro")
        put(MediaStore.Images.Media.IS_PENDING, 1)
    }
    val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, valores)
        ?: throw IOException("MediaStore no creó el archivo")
    try {
        abrirDescarga(fondo.imagen).use { entrada ->
            val salida = resolver.openOutputStream(uri) ?: throw IOException("Sin acceso a $uri")
            salida.use { entrada.copyTo(it) }
        }
        resolver.update(uri, ContentValues().apply { put(MediaStore.Images.Media.IS_PENDING, 0) }, null, null)
    } catch (e: Exception) {
        resolver.delete(uri, null, null)
        throw e
    }
}

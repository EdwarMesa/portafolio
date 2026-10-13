package com.edwarmesa.muro.datos

import android.content.Context
import com.edwarmesa.muro.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.IOException

/**
 * Descarga el catálogo y guarda una copia local para poder abrir la app sin conexión
 * (las imágenes ya vistas quedan en la caché de disco de Coil).
 */
class RepositorioCatalogo(
    context: Context,
    private val base: String = BuildConfig.CATALOGO_URL,
) {
    private val copia = File(context.filesDir, "catalogo.json")

    suspend fun cargar(): Result<Catalogo> = withContext(Dispatchers.IO) {
        runCatching {
            val json = try {
                abrirDescarga(base + "catalogo.json").bufferedReader().use { it.readText() }
                    .also { copia.writeText(it) }
            } catch (e: IOException) {
                if (copia.exists()) copia.readText() else throw e
            }
            parsearCatalogo(json, base)
        }
    }
}

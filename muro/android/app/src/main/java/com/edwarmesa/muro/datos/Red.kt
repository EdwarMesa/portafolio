package com.edwarmesa.muro.datos

import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

/** Abre una descarga HTTP; quien llama debe cerrar el flujo. */
fun abrirDescarga(url: String): InputStream {
    val conexion = URL(url).openConnection() as HttpURLConnection
    conexion.connectTimeout = 10_000
    conexion.readTimeout = 20_000
    if (conexion.responseCode != HttpURLConnection.HTTP_OK) {
        conexion.disconnect()
        throw IOException("HTTP ${conexion.responseCode} al descargar $url")
    }
    return conexion.inputStream
}

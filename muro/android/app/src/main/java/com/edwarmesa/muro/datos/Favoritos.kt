package com.edwarmesa.muro.datos

import android.content.Context
import androidx.core.content.edit
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Favoritos guardados solo en el dispositivo. */
class Favoritos(context: Context) {
    private val prefs = context.getSharedPreferences("muro", Context.MODE_PRIVATE)
    private val _ids = MutableStateFlow(prefs.getStringSet(CLAVE, emptySet()).orEmpty().toSet())
    val ids: StateFlow<Set<String>> = _ids.asStateFlow()

    fun alternar(id: String) {
        val nuevos = if (id in _ids.value) _ids.value - id else _ids.value + id
        _ids.value = nuevos
        prefs.edit { putStringSet(CLAVE, nuevos) }
    }

    private companion object {
        const val CLAVE = "favoritos"
    }
}

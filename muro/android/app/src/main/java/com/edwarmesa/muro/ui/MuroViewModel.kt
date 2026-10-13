package com.edwarmesa.muro.ui

import android.app.Application
import androidx.annotation.StringRes
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.edwarmesa.muro.R
import com.edwarmesa.muro.datos.Catalogo
import com.edwarmesa.muro.datos.Destino
import com.edwarmesa.muro.datos.Favoritos
import com.edwarmesa.muro.datos.Fondo
import com.edwarmesa.muro.datos.RepositorioCatalogo
import com.edwarmesa.muro.datos.aplicarFondo
import com.edwarmesa.muro.datos.descargarFondo
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch

sealed interface EstadoCatalogo {
    data object Cargando : EstadoCatalogo
    data class Listo(val catalogo: Catalogo) : EstadoCatalogo
    data object Error : EstadoCatalogo
}

class MuroViewModel(app: Application) : AndroidViewModel(app) {
    private val repositorio = RepositorioCatalogo(app)
    val favoritos = Favoritos(app)

    var estado by mutableStateOf<EstadoCatalogo>(EstadoCatalogo.Cargando)
        private set

    /** Fondo con una acción en curso (aplicar o descargar). */
    var ocupado by mutableStateOf<String?>(null)
        private set

    private val _mensajes = Channel<Int>(Channel.BUFFERED)
    val mensajes = _mensajes.receiveAsFlow()

    init {
        recargar()
    }

    fun recargar() {
        estado = EstadoCatalogo.Cargando
        viewModelScope.launch {
            estado = repositorio.cargar().fold(
                onSuccess = { EstadoCatalogo.Listo(it) },
                onFailure = { EstadoCatalogo.Error },
            )
        }
    }

    fun aplicar(fondo: Fondo, destino: Destino) =
        trabajar(fondo, R.string.aplicado) { aplicarFondo(getApplication(), fondo, destino) }

    fun descargar(fondo: Fondo) =
        trabajar(fondo, R.string.descargado) { descargarFondo(getApplication(), fondo) }

    private fun trabajar(fondo: Fondo, @StringRes exito: Int, accion: suspend () -> Unit) {
        if (ocupado != null) return
        ocupado = fondo.id
        viewModelScope.launch {
            val mensaje = try {
                accion()
                exito
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                R.string.error_accion
            } finally {
                ocupado = null
            }
            _mensajes.send(mensaje)
        }
    }
}

package com.edwarmesa.muro.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.edwarmesa.muro.BuildConfig
import com.edwarmesa.muro.R

@Composable
fun AppMuro(vm: MuroViewModel = viewModel()) {
    var seccion by rememberSaveable { mutableStateOf(Seccion.EXPLORAR) }
    var categoria by rememberSaveable { mutableStateOf<String?>(null) }
    var abiertoId by rememberSaveable { mutableStateOf<String?>(null) }
    var acerca by rememberSaveable { mutableStateOf(false) }
    val favoritos by vm.favoritos.ids.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    val context = LocalContext.current

    LaunchedEffect(vm) {
        vm.mensajes.collect { snackbar.showSnackbar(context.getString(it)) }
    }

    val estado = vm.estado
    val abierto = (estado as? EstadoCatalogo.Listo)?.catalogo?.fondos?.find { it.id == abiertoId }

    BackHandler(enabled = abiertoId != null) { abiertoId = null }

    Box(Modifier.fillMaxSize()) {
        PantallaLista(
            seccion = seccion,
            estado = estado,
            categoria = categoria,
            favoritos = favoritos,
            onSeccion = { seccion = it },
            onCategoria = { categoria = it },
            onAbrir = { abiertoId = it.id },
            onReintentar = vm::recargar,
            onAcerca = { acerca = true },
        )

        AnimatedContent(
            targetState = abierto,
            transitionSpec = {
                if (targetState != null) {
                    (slideInVertically { it } + fadeIn()) togetherWith fadeOut()
                } else {
                    fadeIn() togetherWith (slideOutVertically { it } + fadeOut())
                }
            },
            contentKey = { it?.id },
            modifier = Modifier.fillMaxSize(),
            label = "detalle",
        ) { fondo ->
            if (fondo != null) {
                PantallaDetalle(
                    fondo = fondo,
                    esFavorito = fondo.id in favoritos,
                    ocupado = vm.ocupado == fondo.id,
                    onVolver = { abiertoId = null },
                    onFavorito = { vm.favoritos.alternar(fondo.id) },
                    onDescargar = { vm.descargar(fondo) },
                    onAplicar = { vm.aplicar(fondo, it) },
                )
            }
        }

        SnackbarHost(
            snackbar,
            Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(bottom = 88.dp),
        )
    }

    if (acerca) {
        val uri = LocalUriHandler.current
        AlertDialog(
            onDismissRequest = { acerca = false },
            title = { Text("${stringResource(R.string.app_name)} ${BuildConfig.VERSION_NAME}") },
            text = { Text(stringResource(R.string.acerca_texto)) },
            confirmButton = {
                TextButton(onClick = { acerca = false }) { Text(stringResource(R.string.cerrar)) }
            },
            dismissButton = {
                TextButton(onClick = { uri.openUri(BuildConfig.PRIVACIDAD_URL) }) {
                    Text(stringResource(R.string.privacidad))
                }
            },
        )
    }
}

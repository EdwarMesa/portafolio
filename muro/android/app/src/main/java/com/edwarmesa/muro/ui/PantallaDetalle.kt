package com.edwarmesa.muro.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.edwarmesa.muro.R
import com.edwarmesa.muro.datos.Destino
import com.edwarmesa.muro.datos.Fondo
import kotlinx.coroutines.delay
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

private val Vidrio = Color.Black.copy(alpha = 0.3f)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PantallaDetalle(
    fondo: Fondo,
    esFavorito: Boolean,
    ocupado: Boolean,
    onVolver: () -> Unit,
    onFavorito: () -> Unit,
    onDescargar: () -> Unit,
    onAplicar: (Destino) -> Unit,
) {
    var vistaBloqueo by rememberSaveable { mutableStateOf(false) }
    var hojaAbierta by rememberSaveable { mutableStateOf(false) }

    Box(Modifier.fillMaxSize().background(fondo.color)) {
        // La miniatura aparece al instante y la imagen completa la cubre al llegar.
        AsyncImage(fondo.miniatura, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        AsyncImage(fondo.imagen, fondo.nombre, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)

        AnimatedVisibility(vistaBloqueo, enter = fadeIn(), exit = fadeOut()) { RelojBloqueo() }

        Row(
            Modifier.fillMaxWidth().statusBarsPadding().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            BotonVidrio(Iconos.Atras, stringResource(R.string.volver), onClick = onVolver)
            BotonVidrio(Iconos.Reloj, stringResource(R.string.vista_bloqueo)) { vistaBloqueo = !vistaBloqueo }
        }

        AnimatedVisibility(
            visible = !vistaBloqueo,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier.align(Alignment.BottomCenter),
        ) {
            Row(
                Modifier
                    .navigationBarsPadding()
                    .padding(16.dp)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(28.dp))
                    .background(Vidrio)
                    .padding(start = 18.dp, top = 10.dp, end = 10.dp, bottom = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Column(Modifier.weight(1f)) {
                    Text(fondo.nombre, color = Color.White, fontWeight = FontWeight.SemiBold)
                    Text(fondo.categoria, color = Color.White.copy(alpha = 0.75f), style = MaterialTheme.typography.bodySmall)
                }
                BotonVidrio(
                    if (esFavorito) Iconos.CorazonLleno else Iconos.Corazon,
                    stringResource(R.string.favorito),
                    fondo = Color.White.copy(alpha = 0.14f),
                    onClick = onFavorito,
                )
                BotonVidrio(
                    Iconos.Descargar,
                    stringResource(R.string.descargar),
                    fondo = Color.White.copy(alpha = 0.14f),
                    onClick = { if (!ocupado) onDescargar() },
                )
                Button(
                    onClick = { hojaAbierta = true },
                    enabled = !ocupado,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.White,
                        contentColor = Color(0xFF141414),
                        disabledContainerColor = Color.White.copy(alpha = 0.7f),
                    ),
                    modifier = Modifier.height(44.dp),
                ) {
                    if (ocupado) {
                        CircularProgressIndicator(Modifier.size(18.dp), color = Color(0xFF141414), strokeWidth = 2.dp)
                    } else {
                        Text(stringResource(R.string.aplicar), fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }

    if (hojaAbierta) {
        ModalBottomSheet(onDismissRequest = { hojaAbierta = false }) {
            Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 28.dp)) {
                Text(
                    stringResource(R.string.aplicar_en),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(start = 12.dp, bottom = 8.dp),
                )
                listOf(
                    Triple(Destino.INICIO, Iconos.Inicio, R.string.destino_inicio),
                    Triple(Destino.BLOQUEO, Iconos.Candado, R.string.destino_bloqueo),
                    Triple(Destino.AMBAS, Iconos.Movil, R.string.destino_ambas),
                ).forEach { (destino, icono, texto) ->
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .clickable {
                                hojaAbierta = false
                                onAplicar(destino)
                            }
                            .padding(horizontal = 12.dp, vertical = 16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        Icon(icono, null)
                        Text(stringResource(texto), style = MaterialTheme.typography.bodyLarge)
                    }
                }
            }
        }
    }
}

@Composable
private fun BotonVidrio(
    icono: ImageVector,
    descripcion: String,
    fondo: Color = Vidrio,
    onClick: () -> Unit,
) {
    Box(
        Modifier.size(44.dp).clip(CircleShape).background(fondo).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icono, descripcion, tint = Color.White, modifier = Modifier.size(22.dp))
    }
}

/** Simula la pantalla de bloqueo para ver cómo queda el reloj sobre el fondo. */
@Composable
private fun RelojBloqueo() {
    var ahora by remember { mutableStateOf(LocalDateTime.now()) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(1_000)
            ahora = LocalDateTime.now()
        }
    }
    val sombra = Shadow(Color.Black.copy(alpha = 0.25f), blurRadius = 24f)
    Column(
        Modifier.fillMaxWidth().statusBarsPadding().padding(top = 96.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            ahora.format(DateTimeFormatter.ofPattern("EEEE, d MMMM")),
            color = Color.White,
            style = MaterialTheme.typography.titleSmall.copy(shadow = sombra),
        )
        Text(
            ahora.format(DateTimeFormatter.ofPattern("HH:mm")),
            color = Color.White,
            style = MaterialTheme.typography.displayLarge.copy(shadow = sombra),
        )
    }
}

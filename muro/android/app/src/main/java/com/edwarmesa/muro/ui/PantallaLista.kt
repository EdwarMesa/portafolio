package com.edwarmesa.muro.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.staggeredgrid.LazyVerticalStaggeredGrid
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridCells
import androidx.compose.foundation.lazy.staggeredgrid.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.edwarmesa.muro.R
import com.edwarmesa.muro.datos.Fondo

enum class Seccion { EXPLORAR, FAVORITOS }

@Composable
fun PantallaLista(
    seccion: Seccion,
    estado: EstadoCatalogo,
    categoria: String?,
    favoritos: Set<String>,
    onSeccion: (Seccion) -> Unit,
    onCategoria: (String?) -> Unit,
    onAbrir: (Fondo) -> Unit,
    onReintentar: () -> Unit,
    onAcerca: () -> Unit,
) {
    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        Column(Modifier.fillMaxSize().statusBarsPadding()) {
            Row(
                Modifier.fillMaxWidth().padding(start = 20.dp, end = 8.dp, top = 12.dp, bottom = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = stringResource(if (seccion == Seccion.FAVORITOS) R.string.favoritos else R.string.app_name),
                    style = MaterialTheme.typography.headlineMedium,
                    modifier = Modifier.weight(1f),
                )
                IconButton(onClick = onAcerca) {
                    Icon(Iconos.Info, contentDescription = stringResource(R.string.acerca))
                }
            }

            when (estado) {
                EstadoCatalogo.Cargando -> Centrado { CircularProgressIndicator(strokeWidth = 2.dp) }
                EstadoCatalogo.Error -> Centrado {
                    Mensaje(stringResource(R.string.error_catalogo))
                    TextButton(onClick = onReintentar) { Text(stringResource(R.string.reintentar)) }
                }
                is EstadoCatalogo.Listo -> {
                    val catalogo = estado.catalogo
                    if (seccion == Seccion.EXPLORAR) {
                        Chips(listOf(null) + catalogo.categorias, categoria, onCategoria)
                    }
                    val visibles = when (seccion) {
                        Seccion.FAVORITOS -> catalogo.fondos.filter { it.id in favoritos }
                        Seccion.EXPLORAR -> catalogo.fondos.filter { categoria == null || it.categoria == categoria }
                    }
                    if (visibles.isEmpty()) {
                        Centrado { Mensaje(stringResource(R.string.sin_favoritos)) }
                    } else {
                        Rejilla(visibles, favoritos, onAbrir)
                    }
                }
            }
        }

        BarraNavegacion(
            seccion = seccion,
            onSeccion = onSeccion,
            modifier = Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(bottom = 16.dp),
        )
    }
}

@Composable
private fun Chips(categorias: List<String?>, actual: String?, onCategoria: (String?) -> Unit) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(categorias) { c ->
            val activo = c == actual
            Surface(
                onClick = { onCategoria(c) },
                shape = CircleShape,
                color = if (activo) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                contentColor = if (activo) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
            ) {
                Text(
                    text = c ?: stringResource(R.string.todos),
                    style = MaterialTheme.typography.labelLarge,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )
            }
        }
    }
}

@Composable
private fun Rejilla(fondos: List<Fondo>, favoritos: Set<String>, onAbrir: (Fondo) -> Unit) {
    LazyVerticalStaggeredGrid(
        columns = StaggeredGridCells.Fixed(2),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 6.dp, bottom = 120.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalItemSpacing = 12.dp,
        modifier = Modifier.fillMaxSize(),
    ) {
        itemsIndexed(fondos, key = { _, f -> f.id }) { i, fondo ->
            // Desfasa la segunda columna para un ritmo escalonado.
            Column {
                if (i == 1) Spacer(Modifier.height(28.dp))
                Tarjeta(fondo, fondo.id in favoritos) { onAbrir(fondo) }
            }
        }
    }
}

@Composable
private fun Tarjeta(fondo: Fondo, esFavorito: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .fillMaxWidth()
            .aspectRatio(9f / 20f)
            .clip(RoundedCornerShape(20.dp))
            .background(fondo.color)
            .clickable(onClick = onClick),
    ) {
        AsyncImage(
            model = fondo.miniatura,
            contentDescription = fondo.nombre,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
        )
        if (esFavorito) {
            Box(
                Modifier.align(Alignment.TopEnd).padding(8.dp).size(28.dp)
                    .clip(CircleShape).background(Color.Black.copy(alpha = 0.25f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Iconos.CorazonLleno, null, tint = Color.White, modifier = Modifier.size(15.dp))
            }
        }
    }
}

@Composable
private fun BarraNavegacion(seccion: Seccion, onSeccion: (Seccion) -> Unit, modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier,
        shape = CircleShape,
        color = MaterialTheme.colorScheme.surface,
        shadowElevation = 8.dp,
    ) {
        Row(Modifier.padding(6.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            ItemNavegacion(Iconos.Rejilla, stringResource(R.string.explorar), seccion == Seccion.EXPLORAR) {
                onSeccion(Seccion.EXPLORAR)
            }
            ItemNavegacion(Iconos.Corazon, stringResource(R.string.favoritos), seccion == Seccion.FAVORITOS) {
                onSeccion(Seccion.FAVORITOS)
            }
        }
    }
}

@Composable
private fun ItemNavegacion(icono: ImageVector, texto: String, activo: Boolean, onClick: () -> Unit) {
    val colores = MaterialTheme.colorScheme
    Row(
        Modifier
            .clip(CircleShape)
            .background(if (activo) colores.primary else Color.Transparent)
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        val color = if (activo) colores.onPrimary else colores.onSurfaceVariant
        Icon(icono, null, tint = color, modifier = Modifier.size(20.dp))
        Text(texto, color = color, style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
private fun Centrado(contenido: @Composable () -> Unit) {
    Column(
        Modifier.fillMaxSize().padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) { contenido() }
}

@Composable
private fun Mensaje(texto: String) {
    Text(
        texto,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
        style = MaterialTheme.typography.bodyMedium,
    )
}

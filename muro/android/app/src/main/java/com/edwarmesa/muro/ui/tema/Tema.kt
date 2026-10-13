package com.edwarmesa.muro.ui.tema

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp

// Neutros cálidos: el color lo ponen los fondos. Mismos tokens que prototipo/prototipo.css.
private val Claro = lightColorScheme(
    primary = Color(0xFF141414),
    onPrimary = Color(0xFFF6F4F0),
    background = Color(0xFFF6F4F0),
    onBackground = Color(0xFF141414),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF141414),
    surfaceVariant = Color(0xFFEBE8E2),
    onSurfaceVariant = Color(0xFF6B6966),
    surfaceContainerLow = Color(0xFFFFFFFF),
    outlineVariant = Color(0xFFE4E1DB),
    inverseSurface = Color(0xFF141414),
    inverseOnSurface = Color(0xFFF6F4F0),
)

private val Oscuro = darkColorScheme(
    primary = Color(0xFFF2F0EC),
    onPrimary = Color(0xFF0F0F0F),
    background = Color(0xFF0F0F0F),
    onBackground = Color(0xFFF2F0EC),
    surface = Color(0xFF1A1A1A),
    onSurface = Color(0xFFF2F0EC),
    surfaceVariant = Color(0xFF222222),
    onSurfaceVariant = Color(0xFF9A9792),
    surfaceContainerLow = Color(0xFF1A1A1A),
    outlineVariant = Color(0xFF2A2A2A),
    inverseSurface = Color(0xFFF2F0EC),
    inverseOnSurface = Color(0xFF0F0F0F),
)

private val Tipografia = Typography().run {
    copy(
        headlineMedium = TextStyle(fontSize = 28.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-0.02).em),
        displayLarge = displayLarge.copy(fontSize = 88.sp, fontWeight = FontWeight.Normal, letterSpacing = (-0.04).em),
        labelLarge = labelLarge.copy(fontWeight = FontWeight.Medium),
    )
}

@Composable
fun MuroTema(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) Oscuro else Claro,
        typography = Tipografia,
        content = content,
    )
}

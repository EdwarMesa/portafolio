package com.edwarmesa.muro.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.unit.dp

/** Iconos de trazo fino propios (los mismos trazados SVG del prototipo). */
object Iconos {
    private const val CORAZON = "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"

    val Atras = icono("M15 5l-7 7 7 7")
    val Reloj = icono("M4 12a8 8 0 1 0 16 0a8 8 0 1 0-16 0", "M12 8v4l3 2")
    val Corazon = icono(CORAZON)
    val CorazonLleno = icono(CORAZON, relleno = true)
    val Descargar = icono("M12 4v11m-5-5 5 5 5-5M5 20h14")
    val Inicio = icono("M4 11l8-7 8 7v9h-5v-6H9v6H4z")
    val Candado = icono("M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z", "M8 11V8a4 4 0 0 1 8 0v3")
    val Movil = icono("M9 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z", "M10 18h4")
    val Rejilla = icono(
        "M6 4h3a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
        "M15 4h3a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
        "M6 15h3a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2z",
        "M15 11h3a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z",
    )
    val Info = icono("M4 12a8 8 0 1 0 16 0a8 8 0 1 0-16 0", "M12 11v5", "M12 8h.01")

    private fun icono(vararg trazos: String, relleno: Boolean = false): ImageVector =
        ImageVector.Builder(
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
            for (trazo in trazos) {
                addPath(
                    pathData = addPathNodes(trazo),
                    fill = if (relleno) SolidColor(Color.Black) else null,
                    stroke = SolidColor(Color.Black),
                    strokeLineWidth = 1.8f,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                )
            }
        }.build()
}

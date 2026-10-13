package com.edwarmesa.muro.datos

import androidx.compose.ui.graphics.Color
import org.json.JSONObject

data class Fondo(
    val id: String,
    val nombre: String,
    val categoria: String,
    val color: Color,
    val imagen: String,
    val miniatura: String,
)

data class Catalogo(
    val categorias: List<String>,
    val fondos: List<Fondo>,
)

/** Convierte catalogo.json en modelos; las rutas relativas se resuelven contra [base]. */
fun parsearCatalogo(json: String, base: String): Catalogo {
    val raiz = JSONObject(json)
    val categorias = raiz.getJSONArray("categorias").let { a -> List(a.length()) { a.getString(it) } }
    val fondos = raiz.getJSONArray("fondos").let { a ->
        List(a.length()) { i ->
            val f = a.getJSONObject(i)
            Fondo(
                id = f.getString("id"),
                nombre = f.getString("nombre"),
                categoria = f.getString("categoria"),
                color = Color(android.graphics.Color.parseColor(f.optString("color", "#888888"))),
                imagen = base + f.getString("imagen"),
                miniatura = base + f.getString("miniatura"),
            )
        }
    }
    return Catalogo(categorias, fondos)
}

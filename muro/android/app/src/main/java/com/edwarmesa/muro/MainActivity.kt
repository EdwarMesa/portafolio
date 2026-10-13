package com.edwarmesa.muro

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.edwarmesa.muro.ui.AppMuro
import com.edwarmesa.muro.ui.tema.MuroTema

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MuroTema { AppMuro() }
        }
    }
}

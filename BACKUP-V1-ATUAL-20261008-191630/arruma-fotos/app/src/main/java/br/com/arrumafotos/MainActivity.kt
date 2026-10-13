package br.com.arrumafotos

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import coil3.compose.AsyncImage
import coil3.request.ImageRequest
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { ArrumaFotosApp() }
    }
}

@Composable
private fun ArrumaFotosApp() {
    val context = LocalContext.current
    var allowed by remember { mutableStateOf(mediaPermission(context)) }
    var loading by remember { mutableStateOf(false) }
    var media by remember { mutableStateOf<List<PhotoItem>>(emptyList()) }
    var filter by remember { mutableStateOf("Todas") }

    val request = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        allowed = mediaPermission(context)
    }

    LaunchedEffect(allowed) {
        if (allowed) {
            loading = true
            media = MediaRepository(context).scanMedia()
            loading = false
        }
    }

    val visible = when (filter) {
        "Fotos" -> media.filter { !it.isVideo }
        "Vídeos" -> media.filter { it.isVideo }
        "Capturas" -> media.filter { it.isScreenshot }
        else -> media
    }

    Scaffold(topBar = { TopAppBar(title = { Text("📸 Arruma Fotos") }) }) { pad ->
        Column(Modifier.fillMaxSize().padding(pad).padding(16.dp)) {
            Text("Organize. Edite. Crie.", style = MaterialTheme.typography.headlineSmall)
            Text("A análise acontece no aparelho. Nada é apagado automaticamente.")
            Spacer(Modifier.height(14.dp))
            if (!allowed) {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text("Permita acesso às suas fotos e vídeos para começar a análise.")
                        Spacer(Modifier.height(10.dp))
                        Button(onClick = {
                            val p = if (Build.VERSION.SDK_INT >= 33) arrayOf(Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.READ_MEDIA_VIDEO) else arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)
                            request.launch(p)
                        }) { Text("Permitir acesso") }
                    }
                }
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("Todas", "Fotos", "Vídeos", "Capturas").forEach { option ->
                        FilterChip(filter == option, { filter = option }, label = { Text(option) })
                    }
                }
                Spacer(Modifier.height(10.dp))
                if (loading) Text("Analisando sua biblioteca…") else {
                    Text("${visible.size} itens encontrados")
                    Spacer(Modifier.height(8.dp))
                    LazyVerticalGrid(columns = GridCells.Fixed(3), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(visible, key = { it.id }) { item ->
                            Card {
                                Column {
                                    AsyncImage(
                                        model = ImageRequest.Builder(context).data(item.uri).crossfade(true).build(),
                                        contentDescription = item.name,
                                        modifier = Modifier.fillMaxWidth().height(105.dp)
                                    )
                                    Text(formatDate(item.dateTaken), Modifier.padding(5.dp), style = MaterialTheme.typography.labelSmall)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun mediaPermission(context: Context): Boolean = if (Build.VERSION.SDK_INT >= 33) {
    ContextCompat.checkSelfPermission(context, Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(context, Manifest.permission.READ_MEDIA_VIDEO) == PackageManager.PERMISSION_GRANTED
} else ContextCompat.checkSelfPermission(context, Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED

private fun formatDate(value: Long): String = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault()).format(Date(value))

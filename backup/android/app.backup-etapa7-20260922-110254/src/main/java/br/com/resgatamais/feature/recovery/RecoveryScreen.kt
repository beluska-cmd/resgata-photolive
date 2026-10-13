package br.com.resgatamais.feature.recovery

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel

@Composable
fun RecoveryScreen(
    viewModel: RecoveryViewModel = viewModel()
) {
    val state by viewModel.uiState.collectAsState()

    val picker =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.OpenDocument()
        ) { uri: Uri? ->
            uri?.let {
                viewModel.protectSelectedFile(it)
            }
        }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {

        Text(
            text = "🆘 Recuperar",
            style = MaterialTheme.typography.headlineMedium
        )

        Text(
            text = "Escolha um arquivo que você quer proteger " +
                "dentro do Resgata+."
        )

        Card(
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "Proteção preventiva",
                    style = MaterialTheme.typography.titleMedium
                )

                Text(
                    text = "O Resgata+ mantém uma referência protegida " +
                        "do arquivo escolhido. Isso não recupera arquivos " +
                        "que já foram apagados."
                )
            }
        }

        Button(
            onClick = {
                picker.launch(
                    arrayOf(
                        "image/*",
                        "video/*",
                        "audio/*",
                        "text/*",
                        "application/pdf",
                        "application/zip",
                        "application/octet-stream"
                    )
                )
            },
            enabled = !state.processing,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                if (state.processing) {
                    "Processando..."
                } else {
                    "Escolher arquivo"
                }
            )
        }

        state.protectedFile?.let { file ->
            Card(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = "🟢 Arquivo protegido",
                        style = MaterialTheme.typography.titleMedium
                    )

                    Text("Nome: ${file.originalName}")
                    Text("Tipo: ${file.mimeType ?: "Desconhecido"}")
                    Text("Tamanho: ${file.sizeBytes} bytes")
                }
            }
        }

        state.error?.let { error ->
            Text(
                text = error,
                color = MaterialTheme.colorScheme.error
            )
        }
    }
}

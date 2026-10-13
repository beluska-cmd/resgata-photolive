package br.com.resgatamais.feature.backup

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import java.text.DateFormat
import java.util.Date

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BackupScreen(
    onBack: () -> Unit = {},
    viewModel: BackupViewModel = viewModel()
) {

    val state by viewModel.uiState.collectAsState()

    var backupToDelete by remember {
        mutableStateOf<String?>(null)
    }

    Scaffold(
        topBar = {

            TopAppBar(
                title = {
                    Text("☁️ Backup")
                },

                navigationIcon = {

                    IconButton(
                        onClick = onBack
                    ) {
                        Icon(
                            imageVector =
                                Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription =
                                "Voltar"
                        )
                    }
                },

                actions = {

                    IconButton(
                        onClick = {
                            viewModel.refresh()
                        }
                    ) {
                        Icon(
                            imageVector =
                                Icons.Filled.Refresh,
                            contentDescription =
                                "Atualizar"
                        )
                    }
                }
            )
        }
    ) { padding ->

        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(20.dp),

            verticalArrangement =
                Arrangement.spacedBy(14.dp)
        ) {

            Text(
                text =
                    "Proteja cópias importantes antes que " +
                    "algum problema aconteça.",
                style =
                    MaterialTheme.typography.bodyLarge
            )

            Card(
                modifier =
                    Modifier.fillMaxWidth()
            ) {

                Column(
                    modifier =
                        Modifier.padding(16.dp),
                    verticalArrangement =
                        Arrangement.spacedBy(8.dp)
                ) {

                    Text(
                        text =
                            "🔐 Backup local",
                        style =
                            MaterialTheme.typography.titleMedium
                    )

                    Text(
                        text =
                            "Nesta versão, o backup fica armazenado " +
                            "no armazenamento privado do Resgata+. " +
                            "Nada é enviado automaticamente para a nuvem."
                    )

                    Button(
                        onClick = {
                            viewModel.createBackup()
                        },
                        enabled = !state.loading,
                        modifier =
                            Modifier.fillMaxWidth()
                    ) {

                        Text(
                            if (state.loading) {
                                "Processando..."
                            } else {
                                "Criar backup agora"
                            }
                        )
                    }
                }
            }

            state.message?.let { message ->

                Text(
                    text = "✅ $message",
                    style =
                        MaterialTheme.typography.bodyMedium
                )
            }

            state.error?.let { error ->

                Text(
                    text = "⚠️ $error",
                    color =
                        MaterialTheme.colorScheme.error
                )
            }

            Text(
                text =
                    "Backups existentes: ${state.backups.size}",
                style =
                    MaterialTheme.typography.titleMedium
            )

            if (state.loading) {

                CircularProgressIndicator()

            } else if (state.backups.isEmpty()) {

                Text(
                    text =
                        "📭 Nenhum backup criado ainda."
                )

            } else {

                LazyColumn(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .weight(1f),

                    verticalArrangement =
                        Arrangement.spacedBy(10.dp)
                ) {

                    items(
                        items = state.backups,
                        key = { it.id }
                    ) { backup ->

                        Card(
                            modifier =
                                Modifier.fillMaxWidth()
                        ) {

                            Column(
                                modifier =
                                    Modifier.padding(16.dp),
                                verticalArrangement =
                                    Arrangement.spacedBy(8.dp)
                            ) {

                                Text(
                                    text =
                                        "📦 Backup local",
                                    style =
                                        MaterialTheme
                                            .typography
                                            .titleMedium
                                )

                                Text(
                                    text =
                                        "Data: " +
                                            formatDate(
                                                backup.createdAt
                                            )
                                )

                                Text(
                                    text =
                                        "Arquivos: " +
                                            backup.itemCount
                                )

                                Text(
                                    text =
                                        "Tamanho: " +
                                            formatSize(
                                                backup.sizeBytes
                                            )
                                )

                                Row(
                                    modifier =
                                        Modifier.fillMaxWidth(),
                                    horizontalArrangement =
                                        Arrangement.spacedBy(8.dp)
                                ) {

                                    Button(
                                        onClick = {
                                            viewModel.restoreBackup(
                                                backup.id
                                            )
                                        },
                                        enabled =
                                            !state.loading
                                    ) {
                                        Text("Restaurar")
                                    }

                                    IconButton(
                                        onClick = {
                                            backupToDelete =
                                                backup.id
                                        }
                                    ) {

                                        Icon(
                                            imageVector =
                                                Icons.Filled.Delete,
                                            contentDescription =
                                                "Excluir backup"
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    backupToDelete?.let { id ->

        AlertDialog(
            onDismissRequest = {
                backupToDelete = null
            },

            title = {
                Text("Excluir backup?")
            },

            text = {
                Text(
                    "A cópia local selecionada será excluída. " +
                    "Os arquivos originais protegidos não serão apagados."
                )
            },

            confirmButton = {

                TextButton(
                    onClick = {

                        viewModel.deleteBackup(id)
                        backupToDelete = null
                    }
                ) {
                    Text("Excluir")
                }
            },

            dismissButton = {

                TextButton(
                    onClick = {
                        backupToDelete = null
                    }
                ) {
                    Text("Cancelar")
                }
            }
        )
    }
}

private fun formatDate(
    timestamp: Long
): String {

    return DateFormat
        .getDateTimeInstance(
            DateFormat.SHORT,
            DateFormat.SHORT
        )
        .format(
            Date(timestamp)
        )
}

private fun formatSize(
    bytes: Long
): String {

    if (bytes < 1024) {
        return "$bytes B"
    }

    if (bytes < 1024 * 1024) {
        return "${bytes / 1024} KB"
    }

    return "${bytes / (1024 * 1024)} MB"
}

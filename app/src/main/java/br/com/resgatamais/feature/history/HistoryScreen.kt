package br.com.resgatamais.feature.history

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
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
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
fun HistoryScreen(
    onBack: () -> Unit = {},
    viewModel: HistoryViewModel = viewModel()
) {

    val entries by viewModel.history.collectAsState()

    var showClearDialog by remember {
        mutableStateOf(false)
    }

    Scaffold(
        topBar = {

            TopAppBar(
                title = {
                    Text("📜 Histórico")
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

                    if (entries.isNotEmpty()) {

                        IconButton(
                            onClick = {
                                showClearDialog = true
                            }
                        ) {

                            Icon(
                                imageVector =
                                    Icons.Filled.DeleteSweep,
                                contentDescription =
                                    "Limpar histórico"
                            )
                        }
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
                    .padding(20.dp)
        ) {

            Text(
                text =
                    "Veja o que o Resgata+ fez ou analisou.",
                style =
                    MaterialTheme.typography.bodyLarge
            )

            if (entries.isEmpty()) {

                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(top = 32.dp),
                    verticalArrangement =
                        Arrangement.spacedBy(10.dp)
                ) {

                    Text(
                        text = "📭 Nenhum registro ainda.",
                        style =
                            MaterialTheme.typography.titleMedium
                    )

                    Text(
                        text =
                            "As ações importantes realizadas " +
                            "pelo Resgata+ aparecerão aqui."
                    )
                }

            } else {

                Text(
                    text =
                        "${entries.size} registro(s)",
                    modifier =
                        Modifier.padding(top = 14.dp),
                    style =
                        MaterialTheme.typography.labelLarge
                )

                LazyColumn(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .weight(1f)
                            .padding(top = 12.dp),

                    verticalArrangement =
                        Arrangement.spacedBy(10.dp)
                ) {

                    items(
                        items = entries,
                        key = { it.id }
                    ) { entry ->

                        Card(
                            modifier =
                                Modifier.fillMaxWidth()
                        ) {

                            Column(
                                modifier =
                                    Modifier.padding(16.dp),
                                verticalArrangement =
                                    Arrangement.spacedBy(6.dp)
                            ) {

                                Row(
                                    modifier =
                                        Modifier.fillMaxWidth(),
                                    horizontalArrangement =
                                        Arrangement.SpaceBetween
                                ) {

                                    Text(
                                        text =
                                            entry.title,
                                        style =
                                            MaterialTheme
                                                .typography
                                                .titleMedium
                                    )
                                }

                                Text(
                                    text =
                                        entry.detail
                                )

                                Text(
                                    text =
                                        entry.category +
                                            " • " +
                                            formatDate(
                                                entry.timestamp
                                            ),
                                    style =
                                        MaterialTheme
                                            .typography
                                            .bodySmall
                                )
                            }
                        }
                    }
                }

                Button(
                    onClick = {
                        showClearDialog = true
                    },
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(top = 12.dp)
                ) {

                    Icon(
                        imageVector =
                            Icons.Filled.DeleteSweep,
                        contentDescription = null
                    )

                    Text(
                        text = "  Limpar histórico"
                    )
                }
            }
        }
    }

    if (showClearDialog) {

        AlertDialog(
            onDismissRequest = {
                showClearDialog = false
            },

            title = {
                Text("Limpar histórico?")
            },

            text = {
                Text(
                    "Todos os registros atuais serão removidos " +
                    "do histórico deste aparelho. " +
                    "Essa ação não pode ser desfeita."
                )
            },

            confirmButton = {

                TextButton(
                    onClick = {

                        showClearDialog = false

                        viewModel.clearHistory()
                    }
                ) {
                    Text("Limpar")
                }
            },

            dismissButton = {

                TextButton(
                    onClick = {
                        showClearDialog = false
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

package br.com.resgatamais.feature.recovery

import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.collectAsState
import androidx.lifecycle.viewmodel.compose.viewModel
import br.com.resgatamais.core.database.entity.ProtectedFileEntity
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun ProtectedFilesScreen(
    onBack: () -> Unit,
    viewModel: ProtectedFilesViewModel = viewModel()
) {
    val files by viewModel.files.collectAsState(initial = emptyList())

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text("Arquivos protegidos")
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector =
                                Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Voltar"
                        )
                    }
                }
            )
        }
    ) { padding ->

        if (files.isEmpty()) {

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {

                Icon(
                    imageVector = Icons.Filled.Description,
                    contentDescription = null
                )

                Spacer(
                    modifier = Modifier.height(16.dp)
                )

                Text(
                    text = "Nenhum arquivo protegido ainda.",
                    style = MaterialTheme.typography.titleMedium
                )

                Spacer(
                    modifier = Modifier.height(8.dp)
                )

                Text(
                    text =
                        "Quando você proteger um arquivo, " +
                        "ele aparecerá aqui.",
                    style = MaterialTheme.typography.bodyMedium
                )
            }

        } else {

            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = 16.dp),
                verticalArrangement =
                    Arrangement.spacedBy(10.dp)
            ) {

                item {
                    Spacer(
                        modifier = Modifier.height(8.dp)
                    )
                }

                items(
                    items = files,
                    key = { it.id }
                ) { file ->

                    ProtectedFileCard(
                        file = file
                    )
                }

                item {
                    Spacer(
                        modifier = Modifier.height(16.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun ProtectedFileCard(
    file: ProtectedFileEntity
) {
    val context = LocalContext.current

    Card(
        modifier = Modifier.fillMaxWidth()
    ) {

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {

            Icon(
                imageVector = Icons.Filled.Description,
                contentDescription = null
            )

            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 12.dp)
            ) {

                Text(
                    text = file.originalName,
                    fontWeight = FontWeight.Bold,
                    maxLines = 2
                )

                Spacer(
                    modifier = Modifier.height(4.dp)
                )

                Text(
                    text =
                        "${formatSize(file.sizeBytes)} • " +
                        formatDate(file.createdAt),
                    style = MaterialTheme.typography.bodySmall
                )
            }

            IconButton(
                onClick = {
                    shareFileInfo(
                        context,
                        file.originalName
                    )
                }
            ) {
                Icon(
                    imageVector = Icons.Filled.Share,
                    contentDescription = "Compartilhar"
                )
            }
        }
    }
}

private fun formatSize(
    bytes: Long
): String {

    if (bytes < 1024) {
        return "$bytes B"
    }

    if (bytes < 1024 * 1024) {
        return "%.1f KB".format(
            Locale.getDefault(),
            bytes / 1024.0
        )
    }

    if (bytes < 1024 * 1024 * 1024) {
        return "%.1f MB".format(
            Locale.getDefault(),
            bytes / (1024.0 * 1024.0)
        )
    }

    return "%.1f GB".format(
        Locale.getDefault(),
        bytes / (1024.0 * 1024.0 * 1024.0)
    )
}

private fun formatDate(
    timestamp: Long
): String {

    return SimpleDateFormat(
        "dd/MM/yyyy HH:mm",
        Locale.getDefault()
    ).format(
        Date(timestamp)
    )
}

private fun shareFileInfo(
    context: android.content.Context,
    name: String
) {

    val intent = Intent(
        Intent.ACTION_SEND
    ).apply {
        type = "text/plain"
        putExtra(
            Intent.EXTRA_TEXT,
            "Arquivo protegido pelo Resgata+: $name"
        )
    }

    context.startActivity(
        Intent.createChooser(
            intent,
            "Compartilhar"
        )
    )
}

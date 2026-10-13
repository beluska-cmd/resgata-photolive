package br.com.resgatamais.feature.recovery

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.Restore
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import br.com.resgatamais.core.database.entity.ProtectedFileEntity
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun ProtectedFilesScreen(
    onBack: () -> Unit,
    viewModel: ProtectedFilesViewModel = viewModel()
) {

    val context = LocalContext.current

    val files by viewModel.files.collectAsState(
        initial = emptyList()
    )

    var fileToDelete by remember {
        mutableStateOf<ProtectedFileEntity?>(null)
    }

    var fileToRestore by remember {
        mutableStateOf<ProtectedFileEntity?>(null)
    }

    val restoreLauncher =
        rememberLauncherForActivityResult(
            contract =
                ActivityResultContracts.CreateDocument("*/*")
        ) { destinationUri ->

            val file = fileToRestore

            if (
                destinationUri != null &&
                file != null
            ) {

                viewModel.restore(
                    file = file,
                    destinationUri = destinationUri
                )
            }

            fileToRestore = null
        }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text("Arquivos protegidos")
                },
                navigationIcon = {
                    IconButton(
                        onClick = onBack
                    ) {
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

            EmptyProtectedFiles(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .padding(padding)
            )

        } else {

            LazyColumn(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(horizontal = 16.dp),
                verticalArrangement =
                    Arrangement.spacedBy(10.dp)
            ) {

                item {
                    Spacer(
                        modifier =
                            Modifier.height(8.dp)
                    )
                }

                items(
                    items = files,
                    key = { it.id }
                ) { file ->

                    ProtectedFileCard(
                        file = file,

                        onOpen = {
                            openProtectedFile(
                                context,
                                file
                            )
                        },

                        onShare = {
                            shareProtectedFile(
                                context,
                                file
                            )
                        },

                        onRestore = {

                            fileToRestore = file

                            restoreLauncher.launch(
                                file.originalName
                            )
                        },

                        onDelete = {
                            fileToDelete = file
                        }
                    )
                }

                item {
                    Spacer(
                        modifier =
                            Modifier.height(16.dp)
                    )
                }
            }
        }
    }

    fileToDelete?.let { file ->

        AlertDialog(
            onDismissRequest = {
                fileToDelete = null
            },

            title = {
                Text("Excluir arquivo protegido?")
            },

            text = {
                Text(
                    "A cópia protegida de " +
                        "\"${file.originalName}\" será " +
                        "excluída do armazenamento " +
                        "do Resgata+."
                )
            },

            confirmButton = {

                TextButton(
                    onClick = {

                        viewModel.delete(file) {
                            fileToDelete = null
                        }
                    }
                ) {
                    Text(
                        "Excluir",
                        color =
                            MaterialTheme
                                .colorScheme
                                .error
                    )
                }
            },

            dismissButton = {

                TextButton(
                    onClick = {
                        fileToDelete = null
                    }
                ) {
                    Text("Cancelar")
                }
            }
        )
    }
}

@Composable
private fun EmptyProtectedFiles(
    modifier: Modifier
) {

    Column(
        modifier =
            modifier.padding(24.dp),

        horizontalAlignment =
            Alignment.CenterHorizontally,

        verticalArrangement =
            Arrangement.Center
    ) {

        Icon(
            imageVector =
                Icons.Filled.Description,
            contentDescription = null
        )

        Spacer(
            modifier =
                Modifier.height(16.dp)
        )

        Text(
            text =
                "Nenhum arquivo protegido ainda.",

            style =
                MaterialTheme
                    .typography
                    .titleMedium
        )

        Spacer(
            modifier =
                Modifier.height(8.dp)
        )

        Text(
            text =
                "Quando você proteger um arquivo, " +
                "ele aparecerá aqui.",

            style =
                MaterialTheme
                    .typography
                    .bodyMedium
        )
    }
}

@Composable
private fun ProtectedFileCard(
    file: ProtectedFileEntity,
    onOpen: () -> Unit,
    onShare: () -> Unit,
    onRestore: () -> Unit,
    onDelete: () -> Unit
) {

    Card(
        modifier =
            Modifier.fillMaxWidth()
    ) {

        Column(
            modifier =
                Modifier.padding(16.dp)
        ) {

            Row(
                verticalAlignment =
                    Alignment.CenterVertically
            ) {

                Icon(
                    imageVector =
                        Icons.Filled.Description,
                    contentDescription = null
                )

                Column(
                    modifier =
                        Modifier
                            .weight(1f)
                            .padding(horizontal = 12.dp)
                ) {

                    Text(
                        text =
                            file.originalName,

                        fontWeight =
                            FontWeight.Bold,

                        maxLines = 2
                    )

                    Spacer(
                        modifier =
                            Modifier.height(4.dp)
                    )

                    Text(
                        text =
                            "${formatSize(file.sizeBytes)} • " +
                            formatDate(file.createdAt),

                        style =
                            MaterialTheme
                                .typography
                                .bodySmall
                    )
                }
            }

            Spacer(
                modifier =
                    Modifier.height(10.dp)
            )

            Row(
                modifier =
                    Modifier.fillMaxWidth(),

                horizontalArrangement =
                    Arrangement.spacedBy(8.dp)
            ) {

                Button(
                    onClick = onOpen,
                    modifier =
                        Modifier.weight(1f)
                ) {

                    Icon(
                        imageVector =
                            Icons.Filled.FolderOpen,
                        contentDescription = null
                    )

                    Text(" Abrir")
                }

                IconButton(
                    onClick = onRestore
                ) {

                    Icon(
                        imageVector =
                            Icons.Filled.Restore,
                        contentDescription =
                            "Restaurar"
                    )
                }

                IconButton(
                    onClick = onShare
                ) {

                    Icon(
                        imageVector =
                            Icons.Filled.Share,
                        contentDescription =
                            "Compartilhar"
                    )
                }

                IconButton(
                    onClick = onDelete
                ) {

                    Icon(
                        imageVector =
                            Icons.Filled.Delete,
                        contentDescription =
                            "Excluir"
                    )
                }
            }
        }
    }
}

private fun openProtectedFile(
    context: Context,
    file: ProtectedFileEntity
) {

    val physicalFile =
        File(
            context.filesDir,
            "protected_files/${file.storedName}"
        )

    if (!physicalFile.exists()) {
        return
    }

    val uri =
        FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            physicalFile
        )

    val intent =
        Intent(Intent.ACTION_VIEW).apply {

            setDataAndType(
                uri,
                file.mimeType ?: "*/*"
            )

            addFlags(
                Intent.FLAG_GRANT_READ_URI_PERMISSION
            )
        }

    try {

        context.startActivity(intent)

    } catch (_: ActivityNotFoundException) {

        shareProtectedFile(
            context,
            file
        )
    }
}

private fun shareProtectedFile(
    context: Context,
    file: ProtectedFileEntity
) {

    val physicalFile =
        File(
            context.filesDir,
            "protected_files/${file.storedName}"
        )

    if (!physicalFile.exists()) {
        return
    }

    val uri =
        FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            physicalFile
        )

    val intent =
        Intent(Intent.ACTION_SEND).apply {

            type =
                file.mimeType ?: "*/*"

            putExtra(
                Intent.EXTRA_STREAM,
                uri
            )

            addFlags(
                Intent.FLAG_GRANT_READ_URI_PERMISSION
            )
        }

    context.startActivity(
        Intent.createChooser(
            intent,
            "Compartilhar arquivo"
        )
    )
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
            bytes /
                (1024.0 * 1024.0)
        )
    }

    return "%.1f GB".format(
        Locale.getDefault(),
        bytes /
            (1024.0 * 1024.0 * 1024.0)
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

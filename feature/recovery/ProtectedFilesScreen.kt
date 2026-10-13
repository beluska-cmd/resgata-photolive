package br.com.resgatamais.feature.recovery

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel

@Composable
fun ProtectedFilesScreen(
    viewModel: ProtectedFilesViewModel =
        viewModel()
) {

    val files by
        viewModel.files.collectAsState(
            initial = emptyList()
        )

    if (files.isEmpty()) {

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(20.dp),
            verticalArrangement =
                Arrangement.spacedBy(10.dp)
        ) {

            Text(
                "🛡️ Meus arquivos protegidos"
            )

            Text(
                "Nenhum arquivo protegido ainda."
            )
        }

        return
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp),
        verticalArrangement =
            Arrangement.spacedBy(10.dp)
    ) {

        items(files) { file ->

            Card(
                modifier = Modifier.fillMaxWidth()
            ) {

                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement =
                        Arrangement.spacedBy(5.dp)
                ) {

                    Text(
                        "🛡️ ${file.originalName}"
                    )

                    Text(
                        "Tamanho: ${file.sizeBytes} bytes"
                    )

                    Text(
                        "Protegido em: ${file.createdAt}"
                    )
                }
            }
        }
    }
}
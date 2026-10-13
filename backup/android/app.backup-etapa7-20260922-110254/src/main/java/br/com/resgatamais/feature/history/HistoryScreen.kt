package br.com.resgatamais.feature.history

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import java.text.DateFormat
import java.util.Date

@Composable
fun HistoryScreen(
    viewModel: HistoryViewModel = viewModel()
) {

    val entries by viewModel.history.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp)
    ) {

        Text(
            text = "📜 Histórico",
            style = MaterialTheme.typography.headlineMedium
        )

        Text(
            text = "Veja o que o Resgata+ fez ou analisou."
        )

        if (entries.isEmpty()) {

            Text(
                text = "Ainda não existem registros.",
                modifier = Modifier.padding(top = 20.dp)
            )

        } else {

            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 16.dp),
                verticalArrangement =
                    Arrangement.spacedBy(10.dp)
            ) {

                items(entries) { entry ->

                    Card(
                        modifier = Modifier.fillMaxWidth()
                    ) {

                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement =
                                Arrangement.spacedBy(5.dp)
                        ) {

                            Text(
                                text = entry.title,
                                style =
                                    MaterialTheme.typography.titleMedium
                            )

                            Text(entry.detail)

                            Text(
                                text =
                                    entry.category +
                                        " • " +
                                        formatDate(entry.timestamp),
                                style =
                                    MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                }
            }
        }
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
        .format(Date(timestamp))
}
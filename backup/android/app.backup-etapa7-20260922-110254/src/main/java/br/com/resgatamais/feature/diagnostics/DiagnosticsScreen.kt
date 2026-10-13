package br.com.resgatamais.feature.diagnostics

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BatteryFull
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.SignalWifi4Bar
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import br.com.resgatamais.core.model.DiagnosticStatus

@androidx.compose.runtime.Composable
fun DiagnosticsScreen(
    viewModel: DiagnosticsViewModel = viewModel()
) {

    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.runDiagnostics()
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {

        item {
            Text(
                text = "🛠️ Resgata meu Android",
                style = MaterialTheme.typography.headlineSmall
            )

            Text(
                text = "Verifique o estado básico do aparelho antes de tentar corrigir qualquer coisa.",
                modifier = Modifier.padding(top = 6.dp)
            )
        }

        if (state.loading) {
            item {
                CircularProgressIndicator()
            }
        }

        state.deviceInfo?.let { device ->

            item {

                Card(
                    modifier = Modifier.fillMaxWidth()
                ) {

                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {

                        Icon(
                            imageVector = Icons.Default.Info,
                            contentDescription = null
                        )

                        Text(
                            text = "Aparelho",
                            style = MaterialTheme.typography.titleLarge
                        )

                        Text(
                            text = "${device.manufacturer} ${device.model}"
                        )

                        Text(
                            text = "Android ${device.androidVersion}"
                        )

                        Text(
                            text = "API ${device.apiLevel}"
                        )
                    }
                }
            }
        }

        state.batteryInfo?.let { battery ->

            item {

                Card(
                    modifier = Modifier.fillMaxWidth()
                ) {

                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {

                        Icon(
                            imageVector = Icons.Default.BatteryFull,
                            contentDescription = null
                        )

                        Text(
                            text = "Bateria",
                            style = MaterialTheme.typography.titleLarge
                        )

                        Text(
                            text = battery.percentage?.let {
                                "Carga: $it%"
                            } ?: "Carga: não disponível"
                        )

                        Text(
                            text = if (battery.isCharging) {
                                "Carregando"
                            } else {
                                "Não está carregando"
                            }
                        )

                        battery.chargingType?.let {
                            Text("Fonte: $it")
                        }

                        battery.temperatureCelsius?.let {
                            Text(
                                text = "Temperatura informada pelo Android: %.1f °C"
                                    .format(it)
                            )
                        }

                        Text(
                            text = "Estado da bateria: ${battery.health ?: "desconhecido"}"
                        )
                    }
                }
            }
        }

        item {

            Card(
                modifier = Modifier.fillMaxWidth()
            ) {

                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {

                    Icon(
                        imageVector = Icons.Default.SignalWifi4Bar,
                        contentDescription = null
                    )

                    Text(
                        text = "Conectividade",
                        style = MaterialTheme.typography.titleLarge
                    )

                    Text(
                        text = "O Resgata+ verifica a rede ativa e se o Android informa acesso validado à Internet."
                    )
                }
            }
        }

        items(state.results) { result ->

            Card(
                modifier = Modifier.fillMaxWidth()
            ) {

                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {

                    val icon = when (result.status) {
                        DiagnosticStatus.OK -> "🟢"
                        DiagnosticStatus.REVIEW -> "🟡"
                        DiagnosticStatus.PROBLEM -> "🔴"
                    }

                    Text(
                        text = "$icon ${result.title}",
                        style = MaterialTheme.typography.titleMedium
                    )

                    Text(result.detail)
                }
            }
        }

        state.error?.let { error ->

            item {

                Card(
                    modifier = Modifier.fillMaxWidth()
                ) {

                    Text(
                        text = "⚠️ $error",
                        modifier = Modifier.padding(16.dp)
                    )
                }
            }
        }

        item {

            Button(
                onClick = {
                    viewModel.runDiagnostics()
                },
                modifier = Modifier.fillMaxWidth()
            ) {

                Icon(
                    imageVector = Icons.Default.Refresh,
                    contentDescription = null
                )

                Text(
                    text = "Verificar novamente",
                    modifier = Modifier.padding(start = 8.dp)
                )
            }
        }

        item {

            Text(
                text = "O diagnóstico informa o que o Android consegue observar. Ele não substitui uma avaliação técnica de hardware.",
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(
                    top = 4.dp,
                    bottom = 20.dp
                )
            )
        }
    }
}
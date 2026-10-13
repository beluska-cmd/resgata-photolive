package br.com.resgatamais.feature.central

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import br.com.resgatamais.core.capability.CapabilityStatus
import br.com.resgatamais.core.capability.ResgataCapabilities
import br.com.resgatamais.core.model.AppModule
import br.com.resgatamais.core.model.ResgataModules

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CentralScreen(
    onModuleSelected: (String) -> Unit
) {

    Scaffold(

        topBar = {

            TopAppBar(
                title = {
                    Text("Resgata+")
                }
            )
        }

    ) { padding ->

        LazyColumn(

            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(padding),

            contentPadding =
                PaddingValues(16.dp),

            verticalArrangement =
                Arrangement.spacedBy(10.dp)
        ) {

            item {

                Text(
                    text =
                        "Recuperar. Organizar. " +
                        "Proteger. Resolver.",

                    style =
                        MaterialTheme
                            .typography
                            .titleMedium
                )

                Spacer(
                    modifier =
                        Modifier.height(6.dp)
                )

                Text(
                    text =
                        "Uma central para cuidar " +
                        "do aparelho e do que importa nele.",

                    style =
                        MaterialTheme
                            .typography
                            .bodyMedium
                )

                Spacer(
                    modifier =
                        Modifier.height(14.dp)
                )

                CapabilityLegend()

                Spacer(
                    modifier =
                        Modifier.height(8.dp)
                )
            }

            items(
                items = ResgataModules.all,
                key = { it.id }
            ) { module ->

                ModuleCard(
                    module = module,
                    onClick = {
                        onModuleSelected(module.id)
                    }
                )
            }
        }
    }
}

@Composable
private fun CapabilityLegend() {

    Column(
        modifier =
            Modifier.fillMaxWidth()
    ) {

        Text(
            text = "Legenda das capacidades",
            style =
                MaterialTheme
                    .typography
                    .titleSmall
        )

        Spacer(
            modifier =
                Modifier.height(6.dp)
        )

        Text("🟢 Disponível")
        Text("🟡 Permissão ou ação necessária")
        Text("🔴 Limitado pelo Android")
    }
}

@Composable
private fun ModuleCard(
    module: AppModule,
    onClick: () -> Unit
) {

    val capability =
        ResgataCapabilities.all
            .firstOrNull {
                it.id == module.id
            }

    val statusText =
        when (capability?.status) {

            CapabilityStatus.AVAILABLE ->
                "🟢 Disponível"

            CapabilityStatus.PERMISSION_REQUIRED ->
                "🟡 Permissão necessária"

            CapabilityStatus.USER_ACTION_REQUIRED ->
                "🟡 Ação/configuração necessária"

            CapabilityStatus.ANDROID_LIMITED ->
                "🔴 Limitado pelo Android"

            null ->
                "🟡 Capacidade ainda não definida"
        }

    Card(

        onClick = onClick,

        modifier =
            Modifier.fillMaxWidth()
    ) {

        Row(

            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(18.dp)
        ) {

            Text(
                text = module.icon,
                style =
                    MaterialTheme
                        .typography
                        .headlineSmall
            )

            Column(
                modifier =
                    Modifier
                        .padding(start = 14.dp)
            ) {

                Text(
                    text = module.title,
                    style =
                        MaterialTheme
                            .typography
                            .titleMedium
                )

                Spacer(
                    modifier =
                        Modifier.height(3.dp)
                )

                Text(
                    text = module.description,
                    style =
                        MaterialTheme
                            .typography
                            .bodyMedium
                )

                Spacer(
                    modifier =
                        Modifier.height(6.dp)
                )

                Text(
                    text = statusText,
                    style =
                        MaterialTheme
                            .typography
                            .labelMedium
                )
            }
        }
    }
}

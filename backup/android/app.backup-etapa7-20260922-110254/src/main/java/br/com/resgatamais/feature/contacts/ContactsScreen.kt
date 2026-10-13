package br.com.resgatamais.feature.contacts

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import br.com.resgatamais.core.model.DuplicateGroup

@Composable
fun ContactsScreen(
    viewModel: ContactsViewModel = viewModel()
) {
    val context = LocalContext.current
    val state by viewModel.uiState.collectAsState()

    val permissionLauncher =
        rememberLauncherForActivityResult(
            ActivityResultContracts.RequestPermission()
        ) { granted ->
            if (granted) {
                viewModel.loadContacts()
            }
        }

    LaunchedEffect(Unit) {
        val granted =
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.READ_CONTACTS
            ) == PackageManager.PERMISSION_GRANTED

        if (granted) {
            viewModel.loadContacts()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {

        Text(
            text = "👥 Contatos",
            style = MaterialTheme.typography.headlineMedium
        )

        Text(
            text = "Organize seus contatos e encontre possíveis números repetidos."
        )

        if (
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.READ_CONTACTS
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            Button(
                onClick = {
                    permissionLauncher.launch(
                        Manifest.permission.READ_CONTACTS
                    )
                }
            ) {
                Text("Permitir acesso aos contatos")
            }
        } else if (state.loading) {

            CircularProgressIndicator()

            Text("Analisando seus contatos...")

        } else {

            ContactSummary(
                total = state.contacts.size,
                duplicateGroups = state.duplicates.size
            )

            if (state.duplicates.isEmpty()) {

                Card(
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Text("🟢 Nenhuma repetição encontrada")

                        Text(
                            "O Resgata+ não encontrou números " +
                                "associados a contatos diferentes."
                        )
                    }
                }

            } else {

                Text("⚠️ Possíveis repetições")

                LazyColumn(
                    verticalArrangement =
                        Arrangement.spacedBy(10.dp)
                ) {
                    items(state.duplicates) { duplicate ->
                        DuplicateCard(
                            duplicate = duplicate
                        )
                    }
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

@Composable
private fun ContactSummary(
    total: Int,
    duplicateGroups: Int
) {
    Card(
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement =
                Arrangement.spacedBy(6.dp)
        ) {
            Text("📊 Resumo")
            Text("Contatos encontrados: $total")
            Text("Possíveis números repetidos: $duplicateGroups")
        }
    }
}

@Composable
private fun DuplicateCard(
    duplicate: DuplicateGroup
) {
    Card(
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement =
                Arrangement.spacedBy(6.dp)
        ) {
            Text(
                text = "Possível duplicidade",
                style = MaterialTheme.typography.titleMedium
            )

            Text(
                text = "Número: ${duplicate.normalizedNumber}"
            )

            Text(
                text =
                    "Contatos encontrados: " +
                        duplicate.contacts.size
            )

            duplicate.contacts.forEach { contact ->
                Text(
                    text = "• ${contact.name}"
                )
            }

            Text(
                text =
                    "O Resgata+ apenas sugere a possível " +
                        "duplicidade. Nenhum contato será mesclado " +
                        "ou apagado automaticamente."
            )
        }
    }
}

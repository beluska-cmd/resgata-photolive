package br.com.resgatamais.feature.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Help
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp

@Composable
fun HomeScreen(
    onFind: () -> Unit,
    onRecovery: () -> Unit,
    onContacts: () -> Unit,
    onDiagnostics: () -> Unit,
    onHelp: () -> Unit,
    onSettings: () -> Unit
) {

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {

        Text(
            text = "Resgata+",
            style = MaterialTheme.typography.headlineLarge
        )

        Text(
            text = "Recuperar. Organizar. Proteger. Resolver.",
            style = MaterialTheme.typography.bodyLarge
        )

        Spacer(
            modifier = Modifier.height(8.dp)
        )

        HomeActionCard(
            icon = Icons.Default.Search,
            title = "Cadê aquilo?",
            description = "Encontre arquivos e informações.",
            onClick = onFind
        )

        HomeActionCard(
            icon = Icons.Default.Folder,
            title = "Resgatar",
            description = "Acesse arquivos que você precisa recuperar.",
            onClick = onRecovery
        )

        HomeActionCard(
            icon = Icons.Default.Person,
            title = "Contatos",
            description = "Organize, proteja e encontre contatos repetidos.",
            onClick = onContacts
        )

        HomeActionCard(
            icon = Icons.Default.Build,
            title = "Resgata meu Android",
            description = "Verifique armazenamento e problemas básicos.",
            onClick = onDiagnostics
        )

        HomeActionCard(
            icon = Icons.Default.Help,
            title = "Preciso de ajuda",
            description = "Converse com a IA ou procure um especialista.",
            onClick = onHelp
        )

        HomeActionCard(
            icon = Icons.Default.Settings,
            title = "Configurações",
            description = "Privacidade, permissões e preferências.",
            onClick = onSettings
        )
    }
}

@Composable
private fun HomeActionCard(
    icon: ImageVector,
    title: String,
    description: String,
    onClick: () -> Unit
) {

    Card(
        modifier = Modifier.fillMaxWidth(),
        onClick = onClick
    ) {

        Row(
            modifier = Modifier.padding(18.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {

            Icon(
                imageVector = icon,
                contentDescription = null
            )

            Column(
                modifier = Modifier.weight(1f)
            ) {

                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium
                )

                Spacer(
                    modifier = Modifier.height(4.dp)
                )

                Text(
                    text = description,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }
    }
}
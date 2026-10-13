package br.com.resgatamais.feature.help

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun HelpScreen() {

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {

        Text("🤝 Preciso de ajuda")

        Text(
            "O chat não recebe automaticamente os dados " +
                "do seu aparelho."
        )

        Button(
            onClick = {}
        ) {
            Text("🤖 Conversar com IA")
        }

        Button(
            onClick = {}
        ) {
            Text("👨‍🔧 Falar com especialista")
        }
    }
}
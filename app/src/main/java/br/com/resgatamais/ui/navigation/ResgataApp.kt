package br.com.resgatamais.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import br.com.resgatamais.feature.backup.BackupScreen
import br.com.resgatamais.feature.central.CentralScreen
import br.com.resgatamais.feature.contacts.ContactsScreen
import br.com.resgatamais.feature.diagnostics.DiagnosticsScreen
import br.com.resgatamais.feature.finder.FinderScreen
import br.com.resgatamais.feature.help.HelpScreen
import br.com.resgatamais.feature.home.HomeScreen
import br.com.resgatamais.feature.history.HistoryScreen
import br.com.resgatamais.feature.recovery.RecoveryScreen
import br.com.resgatamais.feature.recovery.ProtectedFilesScreen
import br.com.resgatamais.feature.settings.SettingsScreen

private data class BottomItem(
    val route: String,
    val label: String,
    val icon: String
)

@Composable
fun ResgataApp() {

    val navController =
        rememberNavController()

    val items = listOf(
        BottomItem("home", "Início", "🏠"),
        BottomItem("central", "Central", "🧭"),
        BottomItem("finder", "Encontrar", "🔎"),
        BottomItem("recovery", "Recuperar", "🆘"),
        BottomItem("diagnostics", "Diagnóstico", "🛠️"),
        BottomItem("settings", "Config.", "⚙️")
    )

    Scaffold(

        bottomBar = {

            NavigationBar {

                val currentEntry by
                    navController
                        .currentBackStackEntryAsState()

                val currentRoute =
                    currentEntry
                        ?.destination
                        ?.route

                items.forEach { item ->

                    NavigationBarItem(

                        selected =
                            currentRoute == item.route,

                        onClick = {

                            navController.navigate(
                                item.route
                            ) {

                                launchSingleTop =
                                    true

                                restoreState =
                                    true
                            }
                        },

                        icon = {
                            Text(item.icon)
                        },

                        label = {
                            Text(item.label)
                        }
                    )
                }
            }
        }

    ) { paddingValues ->

        NavHost(

            navController =
                navController,

            startDestination =
                "home",

            modifier =
                Modifier.padding(
                    paddingValues
                )
        ) {

            /*
             * INÍCIO
             */

            composable("home") {

                HomeScreen(

                    onFind = {
                        navController.navigate(
                            "finder"
                        )
                    },

                    onRecovery = {
                        navController.navigate(
                            "recovery"
                        )
                    },

                    onContacts = {
                        navController.navigate(
                            "contacts"
                        )
                    },

                    onDiagnostics = {
                        navController.navigate(
                            "diagnostics"
                        )
                    },

                    onHelp = {
                        navController.navigate(
                            "help"
                        )
                    },

                    onSettings = {
                        navController.navigate(
                            "settings"
                        )
                    }
                )
            }

            /*
             * CENTRAL
             */

            composable("central") {

                CentralScreen(

                    onModuleSelected = { moduleId ->

                        when (moduleId) {

                            "finder" -> {
                                navController.navigate(
                                    "finder"
                                )
                            }

                            "recovery" -> {
                                navController.navigate(
                                    "recovery"
                                )
                            }

                            "contacts" -> {
                                navController.navigate(
                                    "contacts"
                                )
                            }

                            "diagnostics" -> {
                                navController.navigate(
                                    "diagnostics"
                                )
                            }

                            "specialist" -> {
                                navController.navigate(
                                    "help"
                                )
                            }

                            "ai" -> {
                                navController.navigate(
                                    "help"
                                )
                            }

                            "rescue" -> {
                                navController.navigate(
                                    "diagnostics"
                                )
                            }

                            "battery" -> {
                                navController.navigate(
                                    "diagnostics"
                                )
                            }

                            "network" -> {
                                navController.navigate(
                                    "diagnostics"
                                )
                            }

                            else -> {
                                navController.navigate(
                                    "home"
                                )
                            }
                        }
                    }
                )
            }

            /*
             * ENCONTRAR
             */

            composable("finder") {
                FinderScreen()
            }

            /*
             * RECUPERAR
             */

            composable("recovery") {
                RecoveryScreen(
                    onProtectedFiles = {
                        navController.navigate("protected-files")
                    }
                )
            }

            composable("protected-files") {
                ProtectedFilesScreen(
                    onBack = {
                        navController.popBackStack()
                    }
                )
            }

            composable("backup") {
                BackupScreen(
                    onBack = {
                        navController.popBackStack()
                    }
                )
            }

            /*
             * HISTÓRICO
             */

            composable("history") {
                HistoryScreen()
            }

            /*
             * CONTATOS
             */

            composable("contacts") {
                ContactsScreen()
            }

            /*
             * DIAGNÓSTICO
             */

            composable("diagnostics") {
                DiagnosticsScreen()
            }

            /*
             * AJUDA
             */

            composable("help") {
                HelpScreen()
            }

            /*
             * CONFIGURAÇÕES
             */

            composable("settings") {
                SettingsScreen()
            }
        }
    }
}

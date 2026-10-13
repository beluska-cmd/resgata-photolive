package br.com.resgatamais.feature.backup

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import br.com.resgatamais.core.backup.BackupInfo
import br.com.resgatamais.data.backup.LocalBackupRepository
import br.com.resgatamais.data.history.HistoryLogger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class BackupUiState(
    val loading: Boolean = false,
    val backups: List<BackupInfo> = emptyList(),
    val message: String? = null,
    val error: String? = null
)

class BackupViewModel(
    application: Application
) : AndroidViewModel(application) {

    private val repository =
        LocalBackupRepository(
            application.applicationContext
        )

    private val historyLogger =
        HistoryLogger(
            application.applicationContext
        )

    private val _uiState =
        MutableStateFlow(
            BackupUiState()
        )

    val uiState: StateFlow<BackupUiState> =
        _uiState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {

        viewModelScope.launch(Dispatchers.IO) {

            _uiState.value =
                _uiState.value.copy(
                    backups =
                        repository.listBackups()
                )
        }
    }

    fun createBackup() {

        viewModelScope.launch(Dispatchers.IO) {

            _uiState.value =
                _uiState.value.copy(
                    loading = true,
                    message = null,
                    error = null
                )

            try {

                val backup =
                    repository.createBackup()

                historyLogger.log(
                    title = "Backup criado",
                    detail =
                        "${backup.itemCount} arquivo(s) protegido(s)",
                    category = "backup"
                )

                _uiState.value =
                    BackupUiState(
                        loading = false,
                        backups =
                            repository.listBackups(),
                        message =
                            "Backup criado com sucesso."
                    )

            } catch (error: Exception) {

                val message =
                    error.message
                        ?: "Não foi possível criar o backup."

                _uiState.value =
                    _uiState.value.copy(
                        loading = false,
                        error = message
                    )

                historyLogger.log(
                    title = "Falha ao criar backup",
                    detail = message,
                    category = "backup"
                )
            }
        }
    }

    fun restoreBackup(
        backupId: String
    ) {

        viewModelScope.launch(Dispatchers.IO) {

            _uiState.value =
                _uiState.value.copy(
                    loading = true,
                    message = null,
                    error = null
                )

            try {

                val restored =
                    repository.restoreBackup(
                        backupId
                    )

                historyLogger.log(
                    title = "Backup restaurado",
                    detail =
                        "$restored arquivo(s) restaurado(s)",
                    category = "backup"
                )

                _uiState.value =
                    _uiState.value.copy(
                        loading = false,
                        message =
                            "$restored arquivo(s) restaurado(s)."
                    )

            } catch (error: Exception) {

                val message =
                    error.message
                        ?: "Não foi possível restaurar o backup."

                _uiState.value =
                    _uiState.value.copy(
                        loading = false,
                        error = message
                    )

                historyLogger.log(
                    title = "Falha ao restaurar backup",
                    detail = message,
                    category = "backup"
                )
            }
        }
    }

    fun deleteBackup(
        backupId: String
    ) {

        viewModelScope.launch(Dispatchers.IO) {

            try {

                val deleted =
                    repository.deleteBackup(
                        backupId
                    )

                if (deleted) {

                    historyLogger.log(
                        title = "Backup excluído",
                        detail = backupId,
                        category = "backup"
                    )

                    _uiState.value =
                        _uiState.value.copy(
                            backups =
                                repository.listBackups(),
                            message =
                                "Backup excluído."
                        )

                } else {

                    _uiState.value =
                        _uiState.value.copy(
                            error =
                                "Backup não encontrado."
                        )
                }

            } catch (error: Exception) {

                _uiState.value =
                    _uiState.value.copy(
                        error =
                            error.message
                                ?: "Não foi possível excluir o backup."
                    )
            }
        }
    }

    fun clearMessage() {

        _uiState.value =
            _uiState.value.copy(
                message = null,
                error = null
            )
    }
}

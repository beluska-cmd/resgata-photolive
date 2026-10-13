package br.com.resgatamais.feature.recovery

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import br.com.resgatamais.core.model.ProtectedFile
import br.com.resgatamais.data.files.ProtectedFileRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class RecoveryUiState(
    val processing: Boolean = false,
    val protectedFile: ProtectedFile? = null,
    val error: String? = null
)

class RecoveryViewModel(
    application: Application
) : AndroidViewModel(application) {

    private val repository =
        ProtectedFileRepository(application)

    private val _uiState =
        MutableStateFlow(
            RecoveryUiState()
        )

    val uiState: StateFlow<RecoveryUiState> =
        _uiState.asStateFlow()

    fun protectSelectedFile(
        uri: Uri
    ) {
        viewModelScope.launch(Dispatchers.IO) {

            _uiState.value =
                RecoveryUiState(
                    processing = true
                )

            try {

                val protectedFile =
                    repository.protectFile(uri)

                repository.saveProtectedFile(
                    protectedFile
                )

                _uiState.value =
                    RecoveryUiState(
                        processing = false,
                        protectedFile = protectedFile
                    )

            } catch (error: Exception) {

                _uiState.value =
                    RecoveryUiState(
                        processing = false,
                        error =
                            error.message
                                ?: "Não foi possível proteger o arquivo."
                    )
            }
        }
    }

    fun clearResult() {
        _uiState.value =
            RecoveryUiState()
    }
}

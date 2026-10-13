package br.com.resgatamais.feature.diagnostics

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import br.com.resgatamais.core.model.BatteryInfo
import br.com.resgatamais.core.model.DeviceInfo
import br.com.resgatamais.core.model.DiagnosticResult
import br.com.resgatamais.core.privacy.PrivacyRules
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class DiagnosticsUiState(
    val loading: Boolean = false,
    val deviceInfo: DeviceInfo? = null,
    val batteryInfo: BatteryInfo? = null,
    val results: List<DiagnosticResult> = emptyList(),
    val error: String? = null
)

class DiagnosticsViewModel(
    application: Application
) : AndroidViewModel(application) {

    private val repository =
        DiagnosticsRepository(application.applicationContext)

    private val _uiState =
        MutableStateFlow(DiagnosticsUiState())

    val uiState: StateFlow<DiagnosticsUiState> =
        _uiState.asStateFlow()

    fun runDiagnostics() {

        viewModelScope.launch(Dispatchers.IO) {

            _uiState.value =
                _uiState.value.copy(
                    loading = true,
                    error = null
                )

            try {

                val deviceInfo =
                    repository.getDeviceInfo()

                val batteryInfo =
                    repository.getBatteryInfo()

                val results =
                    repository.runBasicDiagnostics()

                _uiState.value =
                    DiagnosticsUiState(
                        loading = false,
                        deviceInfo = deviceInfo,
                        batteryInfo = batteryInfo,
                        results = results
                    )

            } catch (e: Exception) {

                _uiState.value =
                    _uiState.value.copy(
                        loading = false,
                        error = e.message
                            ?: "Não foi possível executar o diagnóstico."
                    )
            }
        }
    }
}
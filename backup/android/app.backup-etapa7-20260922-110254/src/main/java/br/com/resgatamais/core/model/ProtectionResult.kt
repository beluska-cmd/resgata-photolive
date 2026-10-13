package br.com.resgatamais.core.model

sealed interface ProtectionResult {

    data class Success(
        val file: ProtectedFile
    ) : ProtectionResult

    data class Error(
        val message: String
    ) : ProtectionResult
}
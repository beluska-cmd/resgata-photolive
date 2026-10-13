package br.com.resgatamais.core.model

enum class DiagnosticStatus {
    OK,
    REVIEW,
    PROBLEM
}

data class DiagnosticResult(
    val title: String,
    val detail: String,
    val status: DiagnosticStatus
)
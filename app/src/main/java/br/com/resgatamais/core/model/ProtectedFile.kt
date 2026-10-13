package br.com.resgatamais.core.model

data class ProtectedFile(
    val id: String,
    val originalName: String,
    val storedName: String,
    val uri: String,
    val mimeType: String?,
    val sizeBytes: Long,
    val createdAt: Long,
    val retentionDays: Int? = null
)

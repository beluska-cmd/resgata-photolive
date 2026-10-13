package br.com.resgatamais.core.backup

enum class BackupLocation {
    LOCAL,
    GOOGLE_DRIVE
}

data class BackupInfo(
    val id: String,
    val createdAt: Long,
    val itemCount: Int,
    val sizeBytes: Long,
    val location: BackupLocation
)

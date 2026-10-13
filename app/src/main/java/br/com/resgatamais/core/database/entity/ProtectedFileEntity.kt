package br.com.resgatamais.core.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(
    tableName = "protected_files"
)
data class ProtectedFileEntity(

    @PrimaryKey
    val id: String,

    val originalName: String,

    val storedName: String,

    val mimeType: String?,

    val sizeBytes: Long,

    val createdAt: Long,

    val retentionDays: Int? = null
)
package br.com.resgatamais.data.files

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import br.com.resgatamais.core.database.DatabaseProvider
import br.com.resgatamais.core.database.entity.ProtectedFileEntity
import br.com.resgatamais.core.model.ProtectedFile
import java.io.File
import java.util.UUID

class ProtectedFileRepository(
    private val context: Context
) {

    private val protectedDirectory: File
        get() = File(
            context.filesDir,
            "protected_files"
        ).apply {
            if (!exists()) {
                mkdirs()
            }
        }

    private val dao =
        DatabaseProvider
            .get(context)
            .protectedFileDao()

    fun protectFile(
        uri: Uri
    ): ProtectedFile {

        val originalName =
            getFileName(uri) ?: "arquivo"

        val mimeType =
            context.contentResolver.getType(uri)

        val id =
            UUID.randomUUID().toString()

        val extension =
            extractExtension(originalName)

        val storedName =
            if (extension.isBlank()) {
                id
            } else {
                "$id.$extension"
            }

        val destination =
            File(
                protectedDirectory,
                storedName
            )

        context.contentResolver
            .openInputStream(uri)
            ?.use { input ->
                destination.outputStream()
                    .use { output ->
                        input.copyTo(output)
                    }
            }
            ?: throw IllegalStateException(
                "Não foi possível acessar o arquivo selecionado."
            )

        val createdAt =
            System.currentTimeMillis()

        val protectedFile =
            ProtectedFile(
                id = id,
                originalName = originalName,
                storedName = storedName,
                uri = uri.toString(),
                mimeType = mimeType,
                sizeBytes = destination.length(),
                createdAt = createdAt
            )

        return protectedFile
    }

    suspend fun saveProtectedFile(
        file: ProtectedFile
    ) {
        dao.insert(
            ProtectedFileEntity(
                id = file.id,
                originalName = file.originalName,
                storedName = file.storedName,
                mimeType = file.mimeType,
                sizeBytes = file.sizeBytes,
                createdAt = file.createdAt,
                retentionDays = file.retentionDays
            )
        )
    }

    private fun getFileName(
        uri: Uri
    ): String? {

        context.contentResolver
            .query(
                uri,
                arrayOf(OpenableColumns.DISPLAY_NAME),
                null,
                null,
                null
            )
            ?.use { cursor ->

                if (cursor.moveToFirst()) {

                    val index =
                        cursor.getColumnIndex(
                            OpenableColumns.DISPLAY_NAME
                        )

                    if (index >= 0) {
                        return cursor.getString(index)
                    }
                }
            }

        return uri.lastPathSegment
    }

    private fun extractExtension(
        name: String
    ): String {

        val lastDot =
            name.lastIndexOf('.')

        if (
            lastDot <= 0 ||
            lastDot >= name.length - 1
        ) {
            return ""
        }

        return name
            .substring(lastDot + 1)
            .lowercase()
            .filter {
                it.isLetterOrDigit()
            }
    }
}

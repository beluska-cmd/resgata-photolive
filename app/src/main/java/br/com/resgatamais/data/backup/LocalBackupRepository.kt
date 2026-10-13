package br.com.resgatamais.data.backup

import android.content.Context
import br.com.resgatamais.core.backup.BackupInfo
import br.com.resgatamais.core.backup.BackupLocation
import br.com.resgatamais.core.database.DatabaseProvider
import br.com.resgatamais.core.database.entity.ProtectedFileEntity
import java.io.File
import java.util.UUID

class LocalBackupRepository(
    private val context: Context
) {

    private val database =
        DatabaseProvider.get(context)

    private val protectedDirectory: File
        get() =
            File(
                context.filesDir,
                "protected_files"
            )

    private val backupDirectory: File
        get() =
            File(
                context.filesDir,
                "backups"
            ).apply {
                if (!exists()) {
                    mkdirs()
                }
            }

    suspend fun createBackup(): BackupInfo {

        protectedDirectory.mkdirs()
        backupDirectory.mkdirs()

        val protectedFiles =
            database
                .protectedFileDao()
                .observeAllOnce()

        if (protectedFiles.isEmpty()) {
            throw IllegalStateException(
                "Não existem arquivos protegidos para criar o backup."
            )
        }

        val backupId =
            "backup-" +
                System.currentTimeMillis() +
                "-" +
                UUID.randomUUID()
                    .toString()
                    .take(8)

        val directory =
            File(
                backupDirectory,
                backupId
            )

        directory.mkdirs()

        val manifest =
            File(
                directory,
                "manifest.txt"
            )

        var itemCount = 0
        var totalSize = 0L

        manifest.bufferedWriter().use { writer ->

            writer.write("Resgata+ Backup")
            writer.newLine()

            writer.write("version=1")
            writer.newLine()

            writer.write("createdAt=${System.currentTimeMillis()}")
            writer.newLine()

            protectedFiles.forEach { item ->

                val source =
                    File(
                        protectedDirectory,
                        item.storedName
                    )

                if (!source.exists()) {
                    return@forEach
                }

                val destination =
                    File(
                        directory,
                        item.storedName
                    )

                source.copyTo(
                    destination,
                    overwrite = true
                )

                totalSize +=
                    destination.length()

                itemCount++

                writer.write(
                    listOf(
                        item.id,
                        item.originalName,
                        item.storedName,
                        item.mimeType ?: "",
                        item.sizeBytes,
                        item.createdAt,
                        item.retentionDays ?: ""
                    ).joinToString("|")
                )

                writer.newLine()
            }
        }

        return BackupInfo(
            id = backupId,
            createdAt = directory.lastModified(),
            itemCount = itemCount,
            sizeBytes = totalSize,
            location = BackupLocation.LOCAL
        )
    }

    fun listBackups(): List<BackupInfo> {

        return backupDirectory
            .listFiles()
            ?.filter { directory ->
                directory.isDirectory &&
                    File(
                        directory,
                        "manifest.txt"
                    ).exists()
            }
            ?.map { directory ->

                val files =
                    directory
                        .listFiles()
                        ?.filter {
                            it.name != "manifest.txt"
                        }
                        ?: emptyList()

                BackupInfo(
                    id = directory.name,
                    createdAt =
                        directory.lastModified(),
                    itemCount =
                        files.size,
                    sizeBytes =
                        files.sumOf {
                            it.length()
                        },
                    location =
                        BackupLocation.LOCAL
                )
            }
            ?.sortedByDescending {
                it.createdAt
            }
            ?: emptyList()
    }

    suspend fun restoreBackup(
        backupId: String
    ): Int {

        val directory =
            File(
                backupDirectory,
                backupId
            )

        val manifest =
            File(
                directory,
                "manifest.txt"
            )

        if (
            !directory.exists() ||
            !manifest.exists()
        ) {
            throw IllegalStateException(
                "Backup não encontrado."
            )
        }

        val restoredFiles =
            readManifest(manifest)

        var restored = 0

        restoredFiles.forEach { item ->

            val source =
                File(
                    directory,
                    item.storedName
                )

            if (!source.exists()) {
                return@forEach
            }

            protectedDirectory.mkdirs()

            val destination =
                File(
                    protectedDirectory,
                    item.storedName
                )

            source.copyTo(
                destination,
                overwrite = true
            )

            database
                .protectedFileDao()
                .insert(item)

            restored++
        }

        return restored
    }

    fun deleteBackup(
        backupId: String
    ): Boolean {

        val directory =
            File(
                backupDirectory,
                backupId
            )

        if (!directory.exists()) {
            return false
        }

        return directory.deleteRecursively()
    }

    private fun readManifest(
        manifest: File
    ): List<ProtectedFileEntity> {

        return manifest
            .readLines()
            .drop(3)
            .mapNotNull { line ->

                val parts =
                    line.split(
                        "|",
                        limit = 7
                    )

                if (parts.size < 7) {
                    return@mapNotNull null
                }

                try {

                    ProtectedFileEntity(
                        id = parts[0],
                        originalName = parts[1],
                        storedName = parts[2],
                        mimeType =
                            parts[3]
                                .ifBlank {
                                    null
                                },
                        sizeBytes =
                            parts[4].toLong(),
                        createdAt =
                            parts[5].toLong(),
                        retentionDays =
                            parts[6]
                                .ifBlank {
                                    null
                                }
                                ?.toInt()
                    )

                } catch (
                    _: Exception
                ) {
                    null
                }
            }
    }
}

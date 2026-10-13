package br.com.resgatamais.feature.recovery

import android.net.Uri
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import br.com.resgatamais.core.database.DatabaseProvider
import br.com.resgatamais.core.database.entity.ProtectedFileEntity
import br.com.resgatamais.data.files.ProtectedFileRepository
import br.com.resgatamais.data.history.HistoryLogger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.launch

class ProtectedFilesViewModel(
    application: Application
) : AndroidViewModel(application) {

    private val repository =
        ProtectedFileRepository(
            application.applicationContext
        )

    private val historyLogger =
        HistoryLogger(
            application.applicationContext
        )

    private val dao =
        DatabaseProvider
            .get(application)
            .protectedFileDao()

    val files: Flow<List<ProtectedFileEntity>> =
        dao.observeAll()

    fun delete(
        file: ProtectedFileEntity,
        onResult: (Boolean) -> Unit = {}
    ) {

        viewModelScope.launch(Dispatchers.IO) {

            try {

                val deleted =
                    repository.deleteProtectedFile(file)

                historyLogger.log(
                    title = if (deleted) {
                        "Arquivo protegido excluído"
                    } else {
                        "Falha ao excluir arquivo protegido"
                    },
                    detail = file.originalName,
                    category = "recuperacao"
                )

                onResult(deleted)

            } catch (error: Exception) {

                historyLogger.log(
                    title = "Erro ao excluir arquivo protegido",
                    detail =
                        "${file.originalName}: " +
                        (error.message ?: "erro desconhecido"),
                    category = "recuperacao"
                )

                onResult(false)
            }
        }
    }

    fun restore(
        file: ProtectedFileEntity,
        destinationUri: Uri,
        onResult: (Boolean) -> Unit = {}
    ) {

        viewModelScope.launch(Dispatchers.IO) {

            try {

                if (!repository.exists(file)) {

                    historyLogger.log(
                        title = "Arquivo protegido não encontrado",
                        detail = file.originalName,
                        category = "recuperacao"
                    )

                    onResult(false)
                    return@launch
                }

                val sourceFile =
                    repository.getPhysicalFile(file)

                val resolver =
                    getApplication<Application>()
                        .contentResolver

                resolver.openOutputStream(
                    destinationUri
                )?.use { output ->

                    sourceFile.inputStream().use { input ->
                        input.copyTo(output)
                    }

                } ?: throw IllegalStateException(
                    "Não foi possível criar o arquivo no local escolhido."
                )

                historyLogger.log(
                    title = "Arquivo protegido restaurado",
                    detail = file.originalName,
                    category = "recuperacao"
                )

                onResult(true)

            } catch (error: Exception) {

                historyLogger.log(
                    title = "Erro ao restaurar arquivo",
                    detail =
                        "${file.originalName}: " +
                        (error.message ?: "erro desconhecido"),
                    category = "recuperacao"
                )

                onResult(false)
            }
        }
    }



}

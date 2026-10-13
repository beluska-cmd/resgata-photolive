package br.com.resgatamais.feature.recovery

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import br.com.resgatamais.core.database.DatabaseProvider
import br.com.resgatamais.core.database.entity.ProtectedFileEntity
import kotlinx.coroutines.flow.Flow

class ProtectedFilesViewModel(
    application: Application
) : AndroidViewModel(application) {

    private val database =
        DatabaseProvider.get(application)

    val files: Flow<List<ProtectedFileEntity>> =
        database
            .protectedFileDao()
            .observeAll()
}
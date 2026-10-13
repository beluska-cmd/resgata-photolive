package br.com.resgatamais.feature.recovery

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import br.com.resgatamais.core.database.DatabaseProvider
import br.com.resgatamais.core.database.entity.ProtectedFileEntity
import kotlinx.coroutines.flow.Flow

class ProtectedFilesViewModel(
    application: Application
) : AndroidViewModel(application) {

    private val dao =
        DatabaseProvider
            .get(application)
            .protectedFileDao()

    val files: Flow<List<ProtectedFileEntity>> =
        dao.observeAll()
}

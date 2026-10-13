package br.com.resgatamais.feature.history

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import br.com.resgatamais.core.database.DatabaseProvider
import br.com.resgatamais.core.database.entity.HistoryEntity
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class HistoryViewModel(
    application: Application
) : AndroidViewModel(application) {

    private val database =
        DatabaseProvider.get(application)

    val history: StateFlow<List<HistoryEntity>> =
        database
            .historyDao()
            .observeAll()
            .stateIn(
                scope = viewModelScope,
                started = SharingStarted.WhileSubscribed(5_000),
                initialValue = emptyList()
            )

    fun clearHistory() {

        viewModelScope.launch {

            database
                .historyDao()
                .clear()
        }
    }
}

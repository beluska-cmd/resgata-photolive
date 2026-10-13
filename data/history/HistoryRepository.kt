package br.com.resgatamais.data.history

import br.com.resgatamais.core.database.dao.HistoryDao
import br.com.resgatamais.core.database.entity.HistoryEntity
import kotlinx.coroutines.flow.Flow

class HistoryRepository(
    private val dao: HistoryDao
) {

    fun observeHistory():
        Flow<List<HistoryEntity>> {

        return dao.observeAll()
    }

    suspend fun add(
        title: String,
        detail: String,
        category: String
    ) {

        dao.insert(
            HistoryEntity(
                timestamp =
                    System.currentTimeMillis(),
                title = title,
                detail = detail,
                category = category
            )
        )
    }

    suspend fun clear() {
        dao.clear()
    }
}
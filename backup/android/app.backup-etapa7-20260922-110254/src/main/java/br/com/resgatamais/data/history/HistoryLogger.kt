package br.com.resgatamais.data.history

import android.content.Context
import br.com.resgatamais.core.database.DatabaseProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class HistoryLogger(
    context: Context
) {

    private val dao =
        DatabaseProvider
            .get(context)
            .historyDao()

    suspend fun log(
        title: String,
        detail: String,
        category: String
    ) {

        withContext(Dispatchers.IO) {

            HistoryRepository(dao).add(
                title = title,
                detail = detail,
                category = category
            )
        }
    }
}
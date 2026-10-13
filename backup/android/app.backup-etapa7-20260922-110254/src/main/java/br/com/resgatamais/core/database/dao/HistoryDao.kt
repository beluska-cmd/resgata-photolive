package br.com.resgatamais.core.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import br.com.resgatamais.core.database.entity.HistoryEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface HistoryDao {

    @Insert
    suspend fun insert(
        entry: HistoryEntity
    )

    @Query(
        "SELECT * FROM history " +
            "ORDER BY timestamp DESC"
    )
    fun observeAll():
        Flow<List<HistoryEntity>>

    @Query(
        "DELETE FROM history"
    )
    suspend fun clear()
}
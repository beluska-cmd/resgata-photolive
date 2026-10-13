package br.com.resgatamais.core.database

import androidx.room.Database
import androidx.room.RoomDatabase
import br.com.resgatamais.core.database.dao.HistoryDao
import br.com.resgatamais.core.database.dao.ProtectedFileDao
import br.com.resgatamais.core.database.entity.HistoryEntity
import br.com.resgatamais.core.database.entity.ProtectedFileEntity

@Database(
    entities = [
        ProtectedFileEntity::class,
        HistoryEntity::class
    ],
    version = 1,
    exportSchema = true
)
abstract class ResgataDatabase : RoomDatabase() {

    abstract fun protectedFileDao():
        ProtectedFileDao

    abstract fun historyDao():
        HistoryDao
}
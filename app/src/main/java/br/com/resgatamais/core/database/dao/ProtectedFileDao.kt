package br.com.resgatamais.core.database.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import br.com.resgatamais.core.database.entity.ProtectedFileEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ProtectedFileDao {

    @Insert
    suspend fun insert(
        file: ProtectedFileEntity
    )

    @Delete
    suspend fun delete(
        file: ProtectedFileEntity
    )

    @Query(
        "SELECT * FROM protected_files " +
            "ORDER BY createdAt DESC"
    )
    fun observeAll():
        Flow<List<ProtectedFileEntity>>

    @Query(
        "SELECT * FROM protected_files " +
            "ORDER BY createdAt DESC"
    )
    suspend fun observeAllOnce():
        List<ProtectedFileEntity>

    @Query(
        "SELECT * FROM protected_files " +
            "WHERE id = :id LIMIT 1"
    )
    suspend fun findById(
        id: String
    ): ProtectedFileEntity?

    @Query(
        "DELETE FROM protected_files " +
            "WHERE id = :id"
    )
    suspend fun deleteById(
        id: String
    )
}

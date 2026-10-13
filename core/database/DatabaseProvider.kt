package br.com.resgatamais.core.database

import android.content.Context
import androidx.room.Room

object DatabaseProvider {

    @Volatile
    private var instance: ResgataDatabase? = null

    fun get(
        context: Context
    ): ResgataDatabase {

        return instance
            ?: synchronized(this) {

                instance
                    ?: Room.databaseBuilder(
                        context.applicationContext,
                        ResgataDatabase::class.java,
                        "resgatamais.db"
                    )
                    .build()
                    .also {
                        instance = it
                    }
            }
    }
}
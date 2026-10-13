package br.com.arrumafotos

import android.content.ContentUris
import android.content.Context
import android.provider.MediaStore
import java.util.Locale

class MediaRepository(private val context: Context) {
    fun scanMedia(): List<PhotoItem> {
        val resolver = context.contentResolver
        val result = mutableListOf<PhotoItem>()
        val projection = arrayOf(
            MediaStore.Files.FileColumns._ID,
            MediaStore.Files.FileColumns.DISPLAY_NAME,
            MediaStore.Files.FileColumns.DATE_TAKEN,
            MediaStore.Files.FileColumns.DATE_MODIFIED,
            MediaStore.Files.FileColumns.SIZE,
            MediaStore.Files.FileColumns.MIME_TYPE,
            MediaStore.Files.FileColumns.BUCKET_DISPLAY_NAME,
            MediaStore.Files.FileColumns.MEDIA_TYPE
        )
        val selection = "${MediaStore.Files.FileColumns.MEDIA_TYPE}=? OR ${MediaStore.Files.FileColumns.MEDIA_TYPE}=?"
        val args = arrayOf(
            MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE.toString(),
            MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO.toString()
        )
        resolver.query(
            MediaStore.Files.getContentUri("external"), projection, selection, args,
            "${MediaStore.Files.FileColumns.DATE_TAKEN} DESC"
        )?.use { c ->
            val id = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns._ID)
            val name = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DISPLAY_NAME)
            val taken = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DATE_TAKEN)
            val modified = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DATE_MODIFIED)
            val size = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns.SIZE)
            val mime = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns.MIME_TYPE)
            val bucket = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns.BUCKET_DISPLAY_NAME)
            val type = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns.MEDIA_TYPE)
            while (c.moveToNext()) {
                val mediaId = c.getLong(id)
                val displayName = c.getString(name) ?: "Sem nome"
                val folder = c.getString(bucket)
                val isVideo = c.getInt(type) == MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO
                val date = c.getLong(taken).takeIf { it > 0 } ?: c.getLong(modified) * 1000L
                val uri = ContentUris.withAppendedId(MediaStore.Files.getContentUri("external"), mediaId)
                val lower = "${displayName.lowercase(Locale.ROOT)} ${folder.orEmpty().lowercase(Locale.ROOT)}"
                val screenshot = listOf("screenshot", "captura", "screen_shot", "screenshots").any(lower::contains)
                result += PhotoItem(mediaId, uri, displayName, date, c.getLong(size), c.getString(mime) ?: "", folder, isVideo, screenshot)
            }
        }
        return result
    }
}

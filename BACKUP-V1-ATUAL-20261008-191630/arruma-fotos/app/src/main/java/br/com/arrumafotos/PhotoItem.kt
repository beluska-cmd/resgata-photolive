package br.com.arrumafotos

import android.net.Uri

data class PhotoItem(
    val id: Long,
    val uri: Uri,
    val name: String,
    val dateTaken: Long,
    val size: Long,
    val mimeType: String,
    val bucket: String?,
    val isVideo: Boolean,
    val isScreenshot: Boolean
)

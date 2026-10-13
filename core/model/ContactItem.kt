package br.com.resgatamais.core.model

data class ContactItem(
    val id: Long,
    val name: String,
    val numbers: List<String>
)
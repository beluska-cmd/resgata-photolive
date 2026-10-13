package br.com.resgatamais.core.model

data class DuplicateGroup(
    val normalizedNumber: String,
    val contacts: List<ContactItem>
)
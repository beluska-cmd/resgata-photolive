package br.com.resgatamais.data.contacts

import br.com.resgatamais.core.model.ContactItem
import br.com.resgatamais.core.model.DuplicateGroup
import br.com.resgatamais.core.util.PhoneNormalizer

class ContactAnalyzer {

    fun findDuplicateNumbers(
        contacts: List<ContactItem>
    ): List<DuplicateGroup> {

        val grouped = mutableMapOf<
            String,
            MutableList<ContactItem>
        >()

        contacts.forEach { contact ->

            contact.numbers.forEach { number ->

                val normalized =
                    PhoneNormalizer.normalize(number)

                if (normalized.isBlank()) {
                    return@forEach
                }

                grouped
                    .getOrPut(normalized) {
                        mutableListOf()
                    }
                    .add(contact)
            }
        }

        return grouped
            .filter { (_, contactsWithNumber) ->
                contactsWithNumber
                    .map { it.id }
                    .distinct()
                    .size > 1
            }
            .map { (number, contactList) ->

                DuplicateGroup(
                    normalizedNumber = number,
                    contacts = contactList
                        .distinctBy { it.id }
                )
            }
    }
}
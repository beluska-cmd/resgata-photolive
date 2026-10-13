package br.com.resgatamais.data.contacts

import android.content.ContentResolver
import android.provider.ContactsContract
import br.com.resgatamais.core.model.ContactItem

class ContactsRepository(
    private val contentResolver: ContentResolver
) {

    fun getContacts(): List<ContactItem> {

        val contacts = mutableMapOf<Long, ContactBuilder>()

        val projection = arrayOf(
            ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER
        )

        contentResolver.query(
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
            projection,
            null,
            null,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME
        )?.use { cursor ->

            val idIndex = cursor.getColumnIndex(
                ContactsContract.CommonDataKinds.Phone.CONTACT_ID
            )

            val nameIndex = cursor.getColumnIndex(
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME
            )

            val numberIndex = cursor.getColumnIndex(
                ContactsContract.CommonDataKinds.Phone.NUMBER
            )

            while (cursor.moveToNext()) {

                val id = cursor.getLong(idIndex)

                val name =
                    cursor.getString(nameIndex)
                        ?.trim()
                        .orEmpty()

                val number =
                    cursor.getString(numberIndex)
                        ?.trim()
                        .orEmpty()

                if (number.isBlank()) {
                    continue
                }

                val builder = contacts.getOrPut(id) {
                    ContactBuilder(
                        id = id,
                        name = name
                    )
                }

                builder.numbers.add(number)
            }
        }

        return contacts.values.map {
            ContactItem(
                id = it.id,
                name = it.name.ifBlank {
                    "Sem nome"
                },
                numbers = it.numbers.distinct()
            )
        }
    }

    private data class ContactBuilder(
        val id: Long,
        val name: String,
        val numbers: MutableList<String> = mutableListOf()
    )
}
package br.com.resgatamais.feature.contacts

import android.app.Application
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import br.com.resgatamais.core.model.ContactItem
import br.com.resgatamais.core.model.DuplicateGroup
import br.com.resgatamais.data.contacts.ContactAnalyzer
import br.com.resgatamais.data.contacts.ContactsRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class ContactsUiState(
    val loading: Boolean = false,
    val contacts: List<ContactItem> = emptyList(),
    val duplicates: List<DuplicateGroup> = emptyList(),
    val error: String? = null
)

class ContactsViewModel(
    application: Application
) : AndroidViewModel(application) {

    private val repository =
        ContactsRepository(
            application.contentResolver
        )

    private val analyzer =
        ContactAnalyzer()

    private val _uiState =
        MutableStateFlow(ContactsUiState())

    val uiState: StateFlow<ContactsUiState> =
        _uiState

    fun loadContacts() {

        val context = getApplication<Application>()

        val permission =
            android.Manifest.permission.READ_CONTACTS

        if (
            ContextCompat.checkSelfPermission(
                context,
                permission
            ) != PackageManager.PERMISSION_GRANTED
        ) {

            _uiState.value =
                _uiState.value.copy(
                    error = "Permissão para contatos não concedida."
                )

            return
        }

        viewModelScope.launch(Dispatchers.IO) {

            try {

                _uiState.value =
                    ContactsUiState(
                        loading = true
                    )

                val contacts =
                    repository.getContacts()

                val duplicates =
                    analyzer.findDuplicateNumbers(
                        contacts
                    )

                _uiState.value =
                    ContactsUiState(
                        loading = false,
                        contacts = contacts,
                        duplicates = duplicates
                    )

            } catch (error: Exception) {

                _uiState.value =
                    ContactsUiState(
                        loading = false,
                        error =
                            error.message
                                ?: "Não foi possível ler os contatos."
                    )
            }
        }
    }
}
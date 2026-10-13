package br.com.resgatamais.core.util

object PhoneNormalizer {

    fun normalize(phone: String): String {

        val digits = phone.filter {
            it.isDigit()
        }

        return when {

            digits.startsWith("55") && digits.length > 11 -> {
                digits.removePrefix("55")
            }

            else -> digits
        }
    }
}
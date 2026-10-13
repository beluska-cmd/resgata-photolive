package br.com.resgatamais.feature.diagnostics

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import android.os.StatFs
import br.com.resgatamais.core.model.BatteryInfo
import br.com.resgatamais.core.model.DeviceInfo
import br.com.resgatamais.core.model.DiagnosticResult
import br.com.resgatamais.core.model.DiagnosticStatus

class DiagnosticsRepository(
    private val context: Context
) {

    fun getDeviceInfo(): DeviceInfo {
        return DeviceInfo(
            manufacturer = Build.MANUFACTURER,
            model = Build.MODEL,
            androidVersion = Build.VERSION.RELEASE ?: "Desconhecido",
            apiLevel = Build.VERSION.SDK_INT
        )
    }

    fun getBatteryInfo(): BatteryInfo {

        val intent = context.registerReceiver(
            null,
            IntentFilter(Intent.ACTION_BATTERY_CHANGED)
        )

        if (intent == null) {
            return BatteryInfo(
                percentage = null,
                isCharging = false,
                chargingType = null,
                temperatureCelsius = null,
                health = null
            )
        }

        val level = intent.getIntExtra(
            BatteryManager.EXTRA_LEVEL,
            -1
        )

        val scale = intent.getIntExtra(
            BatteryManager.EXTRA_SCALE,
            -1
        )

        val percentage =
            if (level >= 0 && scale > 0) {
                (level * 100 / scale)
            } else {
                null
            }

        val status = intent.getIntExtra(
            BatteryManager.EXTRA_STATUS,
            BatteryManager.BATTERY_STATUS_UNKNOWN
        )

        val isCharging =
            status == BatteryManager.BATTERY_STATUS_CHARGING ||
            status == BatteryManager.BATTERY_STATUS_FULL

        val plugged = intent.getIntExtra(
            BatteryManager.EXTRA_PLUGGED,
            0
        )

        val chargingType = when (plugged) {
            BatteryManager.BATTERY_PLUGGED_USB -> "USB"
            BatteryManager.BATTERY_PLUGGED_AC -> "Carregador"
            BatteryManager.BATTERY_PLUGGED_WIRELESS -> "Sem fio"
            else -> null
        }

        val rawTemperature = intent.getIntExtra(
            BatteryManager.EXTRA_TEMPERATURE,
            Int.MIN_VALUE
        )

        val temperature =
            if (rawTemperature != Int.MIN_VALUE) {
                rawTemperature / 10f
            } else {
                null
            }

        val healthCode = intent.getIntExtra(
            BatteryManager.EXTRA_HEALTH,
            BatteryManager.BATTERY_HEALTH_UNKNOWN
        )

        val health = when (healthCode) {
            BatteryManager.BATTERY_HEALTH_GOOD -> "Boa"
            BatteryManager.BATTERY_HEALTH_OVERHEAT -> "Superaquecida"
            BatteryManager.BATTERY_HEALTH_DEAD -> "Sem capacidade"
            BatteryManager.BATTERY_HEALTH_OVER_VOLTAGE -> "Sobretensão"
            BatteryManager.BATTERY_HEALTH_COLD -> "Muito fria"
            else -> "Desconhecida"
        }

        return BatteryInfo(
            percentage = percentage,
            isCharging = isCharging,
            chargingType = chargingType,
            temperatureCelsius = temperature,
            health = health
        )
    }

    fun checkStorage(): DiagnosticResult {

        val statFs = StatFs(
            context.filesDir.absolutePath
        )

        val total = statFs.totalBytes
        val available = statFs.availableBytes

        if (total <= 0) {
            return DiagnosticResult(
                title = "Armazenamento",
                detail = "Não foi possível calcular o espaço disponível.",
                status = DiagnosticStatus.REVIEW
            )
        }

        val used = total - available
        val usage = used.toDouble() / total.toDouble()

        return when {
            usage >= 0.95 -> DiagnosticResult(
                title = "Armazenamento",
                detail = "O armazenamento está quase cheio.",
                status = DiagnosticStatus.PROBLEM
            )

            usage >= 0.85 -> DiagnosticResult(
                title = "Armazenamento",
                detail = "O armazenamento está bastante ocupado.",
                status = DiagnosticStatus.REVIEW
            )

            else -> DiagnosticResult(
                title = "Armazenamento",
                detail = "Há espaço disponível no armazenamento.",
                status = DiagnosticStatus.OK
            )
        }
    }

    fun checkConnectivity(): DiagnosticResult {

        val connectivityManager =
            context.getSystemService(
                Context.CONNECTIVITY_SERVICE
            ) as ConnectivityManager

        val network =
            connectivityManager.activeNetwork

        if (network == null) {
            return DiagnosticResult(
                title = "Conectividade",
                detail = "Nenhuma rede ativa foi identificada.",
                status = DiagnosticStatus.PROBLEM
            )
        }

        val capabilities =
            connectivityManager.getNetworkCapabilities(network)

        if (capabilities == null) {
            return DiagnosticResult(
                title = "Conectividade",
                detail = "Não foi possível verificar a rede ativa.",
                status = DiagnosticStatus.REVIEW
            )
        }

        val hasInternet =
            capabilities.hasCapability(
                NetworkCapabilities.NET_CAPABILITY_INTERNET
            )

        val validated =
            capabilities.hasCapability(
                NetworkCapabilities.NET_CAPABILITY_VALIDATED
            )

        val transport = when {
            capabilities.hasTransport(
                NetworkCapabilities.TRANSPORT_WIFI
            ) -> "Wi-Fi"

            capabilities.hasTransport(
                NetworkCapabilities.TRANSPORT_CELLULAR
            ) -> "Rede móvel"

            capabilities.hasTransport(
                NetworkCapabilities.TRANSPORT_ETHERNET
            ) -> "Ethernet"

            else -> "Outra rede"
        }

        return when {
            validated -> DiagnosticResult(
                title = "Conectividade",
                detail = "$transport conectado à Internet.",
                status = DiagnosticStatus.OK
            )

            hasInternet -> DiagnosticResult(
                title = "Conectividade",
                detail = "$transport está conectado, mas a validação da Internet não está disponível.",
                status = DiagnosticStatus.REVIEW
            )

            else -> DiagnosticResult(
                title = "Conectividade",
                detail = "Uma rede está ativa, mas o acesso à Internet não foi confirmado.",
                status = DiagnosticStatus.REVIEW
            )
        }
    }

    fun runBasicDiagnostics(): List<DiagnosticResult> {
        return listOf(
            checkStorage(),
            checkConnectivity()
        )
    }
}
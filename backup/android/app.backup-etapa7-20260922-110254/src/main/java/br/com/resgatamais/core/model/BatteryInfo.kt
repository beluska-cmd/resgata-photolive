package br.com.resgatamais.core.model

data class BatteryInfo(
    val percentage: Int?,
    val isCharging: Boolean,
    val chargingType: String?,
    val temperatureCelsius: Float?,
    val health: String?
)

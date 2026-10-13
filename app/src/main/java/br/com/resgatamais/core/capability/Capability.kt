package br.com.resgatamais.core.capability

enum class CapabilityStatus {
    AVAILABLE,
    PERMISSION_REQUIRED,
    USER_ACTION_REQUIRED,
    ANDROID_LIMITED
}

data class Capability(
    val id: String,
    val title: String,
    val description: String,
    val status: CapabilityStatus
)

object ResgataCapabilities {

    val all = listOf(
        Capability(
            "finder",
            "Cadê Aquilo?",
            "Encontrar arquivos e informações autorizadas.",
            CapabilityStatus.AVAILABLE
        ),
        Capability(
            "recovery",
            "Recuperar",
            "Proteger e restaurar arquivos acessíveis.",
            CapabilityStatus.AVAILABLE
        ),
        Capability(
            "files",
            "Arquivos",
            "Organizar arquivos do aparelho.",
            CapabilityStatus.PERMISSION_REQUIRED
        ),
        Capability(
            "photos",
            "Fotos",
            "Organizar fotos e identificar duplicadas.",
            CapabilityStatus.PERMISSION_REQUIRED
        ),
        Capability(
            "contacts",
            "Contatos",
            "Backup, organização e identificação de duplicados.",
            CapabilityStatus.PERMISSION_REQUIRED
        ),
        Capability(
            "backup",
            "Backup",
            "Criar e restaurar backups selecionados.",
            CapabilityStatus.USER_ACTION_REQUIRED
        ),
        Capability(
            "diagnostics",
            "Diagnóstico",
            "Verificar componentes e conectividade disponíveis.",
            CapabilityStatus.AVAILABLE
        ),
        Capability(
            "repair",
            "Reparo",
            "Orientar correções seguras.",
            CapabilityStatus.USER_ACTION_REQUIRED
        ),
        Capability(
            "security",
            "Segurança",
            "Verificar permissões e condições de segurança.",
            CapabilityStatus.PERMISSION_REQUIRED
        ),
        Capability(
            "spam",
            "Spam e proteção",
            "Analisar conteúdo suspeito dentro das capacidades do Android.",
            CapabilityStatus.PERMISSION_REQUIRED
        ),
        Capability(
            "family",
            "Proteção Familiar",
            "Recursos familiares somente com autorização.",
            CapabilityStatus.USER_ACTION_REQUIRED
        ),
        Capability(
            "ai",
            "IA",
            "Orientação sem acesso automático aos dados do aparelho.",
            CapabilityStatus.AVAILABLE
        ),
        Capability(
            "specialist",
            "Especialistas",
            "Encaminhamento para suporte humano.",
            CapabilityStatus.AVAILABLE
        ),
        Capability(
            "emergency",
            "Emergência",
            "Atalhos e informações configuradas pelo usuário.",
            CapabilityStatus.USER_ACTION_REQUIRED
        ),
        Capability(
            "whatsapp-recovery",
            "Recuperação de WhatsApp",
            "Não acessa dados privados de outros aplicativos.",
            CapabilityStatus.ANDROID_LIMITED
        ),
        Capability(
            "universal-ad-block",
            "Bloqueio universal de anúncios",
            "Não é garantido pelo aplicativo.",
            CapabilityStatus.ANDROID_LIMITED
        ),
        Capability(
            "deleted-private-app-data",
            "Dados privados de aplicativos",
            "O Android pode impedir o acesso.",
            CapabilityStatus.ANDROID_LIMITED
        )
    )
}

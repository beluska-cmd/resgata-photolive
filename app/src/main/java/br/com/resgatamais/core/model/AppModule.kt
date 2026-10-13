package br.com.resgatamais.core.model

data class AppModule(
    val id: String,
    val title: String,
    val description: String,
    val icon: String,
    val enabled: Boolean = true
)

object ResgataModules {

    val all = listOf(
        AppModule("central", "Central", "Tudo do Resgata+ em um só lugar.", "🏠"),
        AppModule("finder", "Cadê Aquilo?", "Encontre o que está procurando.", "🔎"),
        AppModule("rescue", "Resgata Meu Android", "Verifique problemas do aparelho.", "🚨"),
        AppModule("recovery", "Recuperar", "Proteja e recupere o que estiver acessível.", "🆘"),
        AppModule("files", "Arquivos", "Organize seus arquivos.", "📂"),
        AppModule("photos", "Fotos", "Organize suas fotos.", "📸"),
        AppModule("captures", "Capturas", "Organize suas capturas de tela.", "📷"),
        AppModule("information", "Informações", "Veja informações do aparelho.", "💬"),
        AppModule("contacts", "Contatos", "Organize e proteja seus contatos.", "👥"),
        AppModule("memories", "Memórias", "Organize momentos importantes.", "🧠"),
        AppModule("calendar", "Agenda", "Organize seus compromissos.", "📅"),
        AppModule("reminders", "Lembretes", "Não esqueça do que importa.", "🔔"),
        AppModule("projects", "Projetos", "Organize projetos e arquivos.", "💻"),
        AppModule("editor", "Editor", "Edite conteúdos compatíveis.", "✏️"),
        AppModule("converter", "Conversor", "Converta formatos compatíveis.", "🔄"),
        AppModule("backup", "Backup", "Proteja cópias importantes.", "☁️"),
        AppModule("vault", "Cofre", "Proteção local de conteúdo.", "🔐"),
        AppModule("battery", "Bateria", "Veja informações da bateria.", "🔋"),
        AppModule("network", "Rede", "Verifique conectividade.", "📶"),
        AppModule("diagnostics", "Diagnóstico", "Faça uma análise do aparelho.", "🛠️"),
        AppModule("repair", "Reparo", "Receba orientação para correções.", "🔧"),
        AppModule("updates", "Atualizações", "Verifique atualizações disponíveis.", "🔄"),
        AppModule("security", "Segurança", "Verifique pontos de segurança.", "🛡️"),
        AppModule("spam", "Spam", "Analise conteúdo suspeito.", "🚫"),
        AppModule("family", "Família", "Recursos familiares autorizados.", "👨‍👩‍👧"),
        AppModule("sharing", "Compartilhar", "Compartilhe usando o Android.", "📤"),
        AppModule("ai", "IA", "Receba orientação inteligente.", "🤖"),
        AppModule("specialist", "Especialistas", "Fale com suporte humano.", "💬"),
        AppModule("accessibility", "Acessibilidade", "Adapte a experiência.", "♿"),
        AppModule("emergency", "Emergência", "Acesse seus atalhos de emergência.", "🆘"),
        AppModule("history", "Histórico", "Veja as ações realizadas.", "📊")
    )
}

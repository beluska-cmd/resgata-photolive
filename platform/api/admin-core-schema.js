import { db } from "./database.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS admin_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admin_role_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    permission_code TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role, permission_code)
  );

  CREATE TABLE IF NOT EXISTS specialists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    specialty TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    availability TEXT NOT NULL DEFAULT 'offline',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS service_assignments (
    id TEXT PRIMARY KEY,
    service_request_id TEXT,
    ticket_id TEXT,
    specialist_id TEXT,
    status TEXT NOT NULL DEFAULT 'assigned',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (specialist_id)
      REFERENCES specialists(id)
      ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS security_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    device_id TEXT,
    type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    description TEXT,
    metadata TEXT,
    resolved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TEXT,
    FOREIGN KEY (user_id)
      REFERENCES users(id)
      ON DELETE SET NULL,
    FOREIGN KEY (device_id)
      REFERENCES devices(id)
      ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS admin_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    type TEXT NOT NULL DEFAULT 'string',
    description TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS protection_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    severity_default TEXT NOT NULL DEFAULT 'attention',
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS protection_rules (
    id TEXT PRIMARY KEY,
    category_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    rule_type TEXT NOT NULL,
    pattern TEXT,
    action TEXT NOT NULL DEFAULT 'review',
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id)
      REFERENCES protection_categories(id)
      ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS protection_reports (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    device_id TEXT,
    channel TEXT NOT NULL,
    category TEXT,
    risk_level TEXT NOT NULL DEFAULT 'attention',
    reason TEXT,
    action_taken TEXT,
    user_confirmed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)
      REFERENCES users(id)
      ON DELETE SET NULL,
    FOREIGN KEY (device_id)
      REFERENCES devices(id)
      ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS removal_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    channel TEXT NOT NULL,
    target TEXT NOT NULL,
    request_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    method TEXT,
    result TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)
      REFERENCES users(id)
      ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS admin_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id TEXT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    note TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_security_events_created
    ON security_events(created_at);

  CREATE INDEX IF NOT EXISTS idx_security_events_severity
    ON security_events(severity);

  CREATE INDEX IF NOT EXISTS idx_protection_reports_created
    ON protection_reports(created_at);

  CREATE INDEX IF NOT EXISTS idx_removal_requests_status
    ON removal_requests(status);

  CREATE INDEX IF NOT EXISTS idx_service_assignments_specialist
    ON service_assignments(specialist_id);
`);

const permissions = [
  ["dashboard.view", "Visualizar dashboard", "Acessar indicadores administrativos."],
  ["users.view", "Visualizar usuários", "Consultar usuários."],
  ["users.manage", "Gerenciar usuários", "Alterar status e dados administrativos permitidos."],
  ["devices.view", "Visualizar dispositivos", "Consultar dispositivos vinculados."],
  ["services.view", "Visualizar serviços", "Consultar serviços."],
  ["services.manage", "Gerenciar serviços", "Ativar, desativar e configurar serviços."],
  ["requests.view", "Visualizar solicitações", "Consultar solicitações de usuários."],
  ["requests.manage", "Gerenciar solicitações", "Atualizar solicitações."],
  ["support.view", "Visualizar atendimento", "Consultar atendimentos."],
  ["support.manage", "Gerenciar atendimento", "Gerenciar tickets e encaminhamentos."],
  ["specialists.manage", "Gerenciar especialistas", "Cadastrar e administrar especialistas."],
  ["updates.manage", "Gerenciar atualizações", "Gerenciar versões e atualizações."],
  ["plans.manage", "Gerenciar planos", "Configurar planos e recursos."],
  ["security.view", "Visualizar segurança", "Consultar eventos de segurança."],
  ["security.manage", "Gerenciar segurança", "Gerenciar eventos e controles administrativos."],
  ["reports.view", "Visualizar relatórios", "Consultar relatórios."],
  ["logs.view", "Visualizar logs", "Consultar auditoria."],
  ["settings.manage", "Gerenciar configurações", "Alterar configurações administrativas."],
  ["admins.manage", "Gerenciar administradores", "Gerenciar contas administrativas."]
];

const insertPermission = db.prepare(`
  INSERT OR IGNORE INTO admin_permissions (
    code,
    name,
    description
  )
  VALUES (?, ?, ?)
`);

for (const permission of permissions) {
  insertPermission.run(...permission);
}

const superadminPermissions = db.prepare(`
  INSERT OR IGNORE INTO admin_role_permissions (
    role,
    permission_code
  )
  VALUES ('superadmin', ?)
`);

for (const [code] of permissions) {
  superadminPermissions.run(code);
}

const categories = [
  [
    "spam",
    "Spam e comunicação indesejada",
    "Propagandas, mensagens repetitivas e comunicações não desejadas.",
    "attention"
  ],
  [
    "phishing",
    "Phishing",
    "Tentativas de obter informações por meio de mensagens ou páginas falsas.",
    "high"
  ],
  [
    "fraud",
    "Possível fraude",
    "Sinais associados a possíveis tentativas de fraude.",
    "high"
  ],
  [
    "marketing",
    "Marketing",
    "Comunicações promocionais e newsletters.",
    "attention"
  ],
  [
    "telemarketing",
    "Telemarketing",
    "Ligações e contatos comerciais recorrentes.",
    "attention"
  ],
  [
    "suspicious_link",
    "Link suspeito",
    "Links que apresentam sinais que justificam verificação.",
    "high"
  ],
  [
    "impersonation",
    "Falsa identidade",
    "Tentativas de se passar por empresas, serviços ou pessoas.",
    "high"
  ],
  [
    "delivery",
    "Falso aviso de entrega",
    "Mensagens relacionadas a entregas que apresentam sinais suspeitos.",
    "high"
  ]
];

const insertCategory = db.prepare(`
  INSERT OR IGNORE INTO protection_categories (
    id,
    name,
    description,
    severity_default
  )
  VALUES (?, ?, ?, ?)
`);

for (const category of categories) {
  insertCategory.run(...category);
}

const settings = [
  [
    "platform.name",
    "Resgata+",
    "string",
    "Nome da plataforma."
  ],
  [
    "platform.maintenance",
    "false",
    "boolean",
    "Indica se a plataforma está em manutenção."
  ],
  [
    "security.max_admin_session_hours",
    "8",
    "number",
    "Duração máxima da sessão administrativa."
  ],
  [
    "protection.enabled",
    "true",
    "boolean",
    "Ativa o módulo de Limpeza, Spam e Proteção."
  ],
  [
    "protection.require_user_confirmation",
    "true",
    "boolean",
    "Exige confirmação do usuário antes de ações sensíveis."
  ],
  [
    "notifications.admin_alerts",
    "true",
    "boolean",
    "Ativa alertas administrativos."
  ]
];

const insertSetting = db.prepare(`
  INSERT OR IGNORE INTO admin_settings (
    key,
    value,
    type,
    description
  )
  VALUES (?, ?, ?, ?)
`);

for (const setting of settings) {
  insertSetting.run(...setting);
}

console.log("ADMIN CORE: banco preparado com sucesso.");

import { db } from "./database.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS resgata_conteudos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    categoria TEXT NOT NULL DEFAULT 'geral',
    tipo TEXT NOT NULL DEFAULT 'texto',
    descricao TEXT DEFAULT '',
    conteudo TEXT DEFAULT '',
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_resgata_conteudos_categoria
    ON resgata_conteudos(categoria);

  CREATE INDEX IF NOT EXISTS idx_resgata_conteudos_ativo
    ON resgata_conteudos(ativo);

  CREATE TABLE IF NOT EXISTS ticket_messages (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    sender_type TEXT NOT NULL
      CHECK(sender_type IN ('client', 'admin', 'specialist', 'system')),
    sender_id TEXT,
    message TEXT NOT NULL,
    internal INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    FOREIGN KEY (ticket_id)
      REFERENCES tickets(id)
      ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_created
    ON ticket_messages(ticket_id, created_at);

  CREATE INDEX IF NOT EXISTS idx_ticket_messages_sender
    ON ticket_messages(sender_id);


  CREATE TABLE IF NOT EXISTS resgata_emergency_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT NOT NULL DEFAULT '',
    description TEXT DEFAULT '',
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

const settings = [
  [
    "emergency.enabled",
    "true",
    "Ativa o módulo de emergência."
  ],
  [
    "emergency.escalation_enabled",
    "true",
    "Permite reforço automático de proteção."
  ],
  [
    "emergency.admin_alerts",
    "true",
    "Permite alertas administrativos."
  ]
];

const insert = db.prepare(`
  INSERT OR IGNORE INTO resgata_emergency_settings
  (setting_key, setting_value, description)
  VALUES (?, ?, ?)
`);

for (const item of settings) {
  insert.run(...item);
}

console.log(
  "ADMIN SUPPORT SCHEMA: banco preparado."
);

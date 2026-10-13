import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, "data");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "resgata.db");

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    client_visible INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT,
    model TEXT,
    android_version TEXT,
    app_version TEXT,
    last_seen TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    priority TEXT NOT NULL DEFAULT 'normal',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Disponível',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS service_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    service_id TEXT NOT NULL,
    device_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    details TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (service_id) REFERENCES services(id),
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS diagnostics (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    device_id TEXT,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'received',
    result TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    action TEXT NOT NULL,
    entity TEXT,
    entity_id TEXT,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const serviceCount = db
  .prepare("SELECT COUNT(*) AS total FROM services")
  .get();

if (serviceCount.total === 0) {
  const insertService = db.prepare(`
    INSERT INTO services
    (id, name, description, category, enabled, client_visible)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const services = [
    [
      "recovery",
      "Recuperação",
      "Recursos para localizar e recuperar arquivos e informações.",
      "Recuperar",
      1,
      1
    ],
    [
      "protection",
      "Proteção",
      "Ferramentas e orientações para proteger seus dados e dispositivo.",
      "Segurança",
      1,
      1
    ],
    [
      "backup",
      "Backup",
      "Organize e acompanhe seus backups.",
      "Dados",
      1,
      1
    ],
    [
      "diagnostics",
      "Diagnóstico",
      "Acompanhe diagnósticos realizados pelo aplicativo.",
      "Dispositivo",
      1,
      1
    ],
    [
      "updates",
      "Atualizações",
      "Informações sobre versões e atualizações do Resgata+.",
      "Aplicativo",
      1,
      1
    ],
    [
      "support",
      "Suporte",
      "Solicite ajuda e acompanhe seus atendimentos.",
      "Atendimento",
      1,
      1
    ]
  ];

  const insertMany = db.transaction((items) => {
    for (const item of items) {
      insertService.run(...item);
    }
  });

  insertMany(services);
}

const updateCount = db
  .prepare("SELECT COUNT(*) AS total FROM updates")
  .get();

if (updateCount.total === 0) {
  db.prepare(`
    INSERT INTO updates
    (version, type, description, status)
    VALUES (?, ?, ?, ?)
  `).run(
    "1.0.0",
    "Aplicativo",
    "Primeira versão integrada do Resgata+.",
    "Disponível"
  );
}

const planCount = db
  .prepare("SELECT COUNT(*) AS total FROM plans")
  .get();

if (planCount.total === 0) {
  const insertPlan = db.prepare(`
    INSERT INTO plans
    (id, name, description, price, active)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertPlan.run(
    "free",
    "Gratuito",
    "Acesso aos recursos básicos da Central Resgata+.",
    0,
    1
  );

  insertPlan.run(
    "premium",
    "Premium",
    "Acesso ampliado aos serviços e recursos do Resgata+.",
    0,
    1
  );
}

export { db, dbPath };
export default db;

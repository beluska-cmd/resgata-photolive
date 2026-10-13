import { db } from "./database.js";

console.log("RESGATA+ BETTING PROTECTION: preparando banco...");

db.exec(`
  -- ============================================
  -- CONFIGURAÇÃO DE PROTEÇÃO POR USUÁRIO
  -- ============================================

  CREATE TABLE IF NOT EXISTS betting_protection_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    enabled INTEGER NOT NULL DEFAULT 1,
    mode TEXT NOT NULL DEFAULT 'normal',
    protection_level TEXT NOT NULL DEFAULT 'normal',
    relapse_block INTEGER NOT NULL DEFAULT 1,
    block_sites INTEGER NOT NULL DEFAULT 1,
    block_apps INTEGER NOT NULL DEFAULT 1,
    block_links INTEGER NOT NULL DEFAULT 1,
    block_redirects INTEGER NOT NULL DEFAULT 1,
    protected_time INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- ============================================
  -- NÍVEIS DE PROTEÇÃO
  -- ============================================

  CREATE TABLE IF NOT EXISTS betting_protection_levels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    escalation_level INTEGER NOT NULL DEFAULT 1,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  -- ============================================
  -- DOMÍNIOS DE APOSTAS
  -- ============================================

  CREATE TABLE IF NOT EXISTS betting_blocked_domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL DEFAULT 'betting',
    source TEXT NOT NULL DEFAULT 'manual',
    confidence REAL DEFAULT 1.0,
    enabled INTEGER NOT NULL DEFAULT 1,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  -- ============================================
  -- APLICATIVOS
  -- ============================================

  CREATE TABLE IF NOT EXISTS betting_blocked_apps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    package_name TEXT NOT NULL UNIQUE,
    app_name TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    enabled INTEGER NOT NULL DEFAULT 1,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  -- ============================================
  -- LINKS / PADRÕES
  -- ============================================

  CREATE TABLE IF NOT EXISTS betting_blocked_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern TEXT NOT NULL UNIQUE,
    pattern_type TEXT NOT NULL DEFAULT 'keyword',
    source TEXT NOT NULL DEFAULT 'manual',
    enabled INTEGER NOT NULL DEFAULT 1,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  -- ============================================
  -- TENTATIVAS DE ACESSO
  -- ============================================

  CREATE TABLE IF NOT EXISTS betting_access_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    device_id INTEGER,
    domain TEXT,
    app_package TEXT,
    url TEXT,
    attempt_type TEXT NOT NULL DEFAULT 'unknown',
    detection_source TEXT,
    blocked INTEGER NOT NULL DEFAULT 0,
    protection_level TEXT NOT NULL DEFAULT 'normal',
    risk_level TEXT NOT NULL DEFAULT 'attention',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- ============================================
  -- REINCIDÊNCIAS / ESCALADA DE PROTEÇÃO
  -- ============================================

  CREATE TABLE IF NOT EXISTS betting_relapses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    attempt_id INTEGER,
    previous_level TEXT,
    new_level TEXT,
    reason TEXT,
    automatic INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (attempt_id) REFERENCES betting_access_attempts(id)
  );

  -- ============================================
  -- RADAR RESGATA+
  -- ============================================

  CREATE TABLE IF NOT EXISTS betting_radar_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT,
    url TEXT,
    item_type TEXT NOT NULL DEFAULT 'unknown',
    classification TEXT NOT NULL DEFAULT 'desconhecido',
    confidence REAL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'radar',
    status TEXT NOT NULL DEFAULT 'pending',
    validated INTEGER NOT NULL DEFAULT 0,
    added_to_blocklist INTEGER NOT NULL DEFAULT 0,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  -- ============================================
  -- DISPOSITIVOS PROTEGIDOS
  -- ============================================

  CREATE TABLE IF NOT EXISTS betting_protected_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    device_id INTEGER,
    protection_level TEXT NOT NULL DEFAULT 'normal',
    enabled INTEGER NOT NULL DEFAULT 1,
    last_sync_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, device_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (device_id) REFERENCES devices(id)
  );

  -- ============================================
  -- CONFIGURAÇÕES GERAIS DO MÓDULO
  -- ============================================

  CREATE TABLE IF NOT EXISTS betting_protection_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT,
    description TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  -- ============================================
  -- ÍNDICES
  -- ============================================

  CREATE INDEX IF NOT EXISTS idx_betting_attempts_user
    ON betting_access_attempts(user_id);

  CREATE INDEX IF NOT EXISTS idx_betting_attempts_created
    ON betting_access_attempts(created_at);

  CREATE INDEX IF NOT EXISTS idx_betting_attempts_domain
    ON betting_access_attempts(domain);

  CREATE INDEX IF NOT EXISTS idx_betting_relapses_user
    ON betting_relapses(user_id);

  CREATE INDEX IF NOT EXISTS idx_betting_relapses_created
    ON betting_relapses(created_at);

  CREATE INDEX IF NOT EXISTS idx_betting_radar_status
    ON betting_radar_items(status);

  CREATE INDEX IF NOT EXISTS idx_betting_radar_created
    ON betting_radar_items(created_at);

  CREATE INDEX IF NOT EXISTS idx_betting_devices_user
    ON betting_protected_devices(user_id);
`);

console.log("RESGATA+ BETTING PROTECTION: schema criado com sucesso.");

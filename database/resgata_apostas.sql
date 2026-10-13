-- RESGATA+ — MÓDULO DE PROTEÇÃO FINANCEIRA

CREATE TABLE IF NOT EXISTS aposta_registros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    data TEXT NOT NULL,
    valor_deposito REAL NOT NULL DEFAULT 0,
    valor_ganho_imaginado REAL DEFAULT 0,
    valor_saque_imaginado REAL DEFAULT 0,
    valor_ganho_informado REAL DEFAULT 0,
    valor_perdido_informado REAL DEFAULT 0,
    observacao TEXT,
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contas_resgata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    nome TEXT NOT NULL,
    valor REAL NOT NULL DEFAULT 0,
    vencimento TEXT,
    status TEXT NOT NULL DEFAULT 'pendente',
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS valor_conta_protegido (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registro_id INTEGER NOT NULL,
    conta_id INTEGER,
    valor REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (registro_id) REFERENCES aposta_registros(id),
    FOREIGN KEY (conta_id) REFERENCES contas_resgata(id)
);

CREATE TABLE IF NOT EXISTS missoes_diarias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    data TEXT NOT NULL,
    nao_apostou INTEGER NOT NULL DEFAULT 0,
    teve_vontade INTEGER NOT NULL DEFAULT 0,
    valor_protegido REAL NOT NULL DEFAULT 0,
    concluida INTEGER NOT NULL DEFAULT 0,
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(usuario_id, data)
);

CREATE TABLE IF NOT EXISTS tentativas_aposta (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    data TEXT NOT NULL,
    tipo TEXT,
    dominio TEXT,
    bloqueada INTEGER NOT NULL DEFAULT 0,
    nivel_protecao TEXT DEFAULT 'normal',
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sugestoes_resgata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    categoria TEXT,
    texto TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'recebida',
    votos INTEGER NOT NULL DEFAULT 0,
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

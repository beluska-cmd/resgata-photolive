import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, dbPath } from "./database.js";
import { verifyPassword } from "./admin-auth.js";
import adminDevicesRoutes from "./admin-devices-routes.js";
import adminServicesRoutes from "./admin-services-routes.js";
import { registerAdminUsersRoutes } from "./admin-users-routes.js";
import { registerAdminCoreRoutes } from "./admin-core-routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

registerAdminCoreRoutes(app, requireAdmin);
registerAdminUsersRoutes(app, requireAdmin, db);

const PORT = process.env.PORT || 8788;

app.use(express.json({ limit: "2mb" }));

function id() {
  return crypto.randomUUID();
}

function token() {
  return crypto.randomBytes(32).toString("hex");
}

function now() {
  return Date.now().toString();
}

function adminSession(admin) {
  const sessionToken = token();
  const createdAt = Date.now();
  const expiresAt = createdAt + (8 * 60 * 60 * 1000);

  db.prepare(`
    INSERT INTO admin_sessions (
      token,
      admin_id,
      created_at,
      expires_at
    )
    VALUES (?, ?, ?, ?)
  `).run(
    sessionToken,
    admin.id,
    createdAt.toString(),
    expiresAt.toString()
  );

  return {
    token: sessionToken,
    expiresAt
  };
}

function getAdminFromRequest(req) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return null;
  }

  const sessionToken = header.slice(7).trim();

  if (!sessionToken) {
    return null;
  }

  const session = db.prepare(`
    SELECT
      s.token,
      s.expires_at,
      a.id,
      a.name,
      a.email,
      a.role,
      a.status
    FROM admin_sessions s
    JOIN admins a ON a.id = s.admin_id
    WHERE s.token = ?
  `).get(sessionToken);

  if (!session) {
    return null;
  }

  if (session.status !== "active") {
    return null;
  }

  if (
    session.expires_at &&
    Number(session.expires_at) < Date.now()
  ) {
    db.prepare(
      "DELETE FROM admin_sessions WHERE token = ?"
    ).run(sessionToken);

    return null;
  }

  return {
    id: session.id,
    name: session.name,
    email: session.email,
    role: session.role,
    token: sessionToken
  };
}


// ===== ADMIN AUTH ROUTES =====

app.post("/api/admin/login", (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        error: "EMAIL_E_SENHA_OBRIGATORIOS"
      });
    }

    const admin = db.prepare(`
      SELECT
        id,
        name,
        email,
        password,
        role,
        status
      FROM admins
      WHERE email = ?
      LIMIT 1
    `).get(email);

    if (!admin || admin.status !== "active") {
      return res.status(401).json({
        ok: false,
        error: "CREDENCIAIS_INVALIDAS"
      });
    }

    if (!verifyPassword(password, admin.password)) {
      return res.status(401).json({
        ok: false,
        error: "CREDENCIAIS_INVALIDAS"
      });
    }

    const session = adminSession(admin);

    db.prepare(`
      INSERT INTO audit_logs (
        action,
        entity,
        entity_id,
        details,
        created_at
      )
      VALUES (?, ?, ?, ?, ?)
    `).run(
      "admin.login",
      "admin",
      admin.id,
      JSON.stringify({
        email: admin.email
      }),
      now()
    );

    return res.json({
      ok: true,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      },
      token: session.token,
      expiresAt: session.expiresAt
    });
  } catch (error) {
    console.error("ADMIN LOGIN ERROR:", error);

    return res.status(500).json({
      ok: false,
      error: "ADMIN_LOGIN_ERROR"
    });
  }
});

app.get("/api/admin/me", requireAdmin, (req, res) => {
  return res.json({
    ok: true,
    admin: {
      id: req.admin.id,
      name: req.admin.name,
      email: req.admin.email,
      role: req.admin.role
    }
  });
});

app.post("/api/admin/logout", requireAdmin, (req, res) => {
  try {
    db.prepare(`
      DELETE FROM admin_sessions
      WHERE token = ?
    `).run(req.admin.token);

    db.prepare(`
      INSERT INTO audit_logs (
        action,
        entity,
        entity_id,
        details,
        created_at
      )
      VALUES (?, ?, ?, ?, ?)
    `).run(
      "admin.logout",
      "admin",
      req.admin.id,
      JSON.stringify({
        email: req.admin.email
      }),
      now()
    );

    return res.json({
      ok: true
    });
  } catch (error) {
    console.error("ADMIN LOGOUT ERROR:", error);

    return res.status(500).json({
      ok: false,
      error: "ADMIN_LOGOUT_ERROR"
    });
  }
});

function requireAdmin(req, res, next) {
  const admin = getAdminFromRequest(req);

  if (!admin) {
    return res.status(401).json({
      ok: false,
      error: "ADMIN_AUTH_REQUIRED"
    });
  }

  req.admin = admin;
  next();
}


function getBearerToken(req) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice(7).trim() || null;
}

function currentAccount(req) {
  const sessionToken = getBearerToken(req);

  if (!sessionToken) {
    return null;
  }

  const session = db.prepare(`
    SELECT
      s.token,
      s.user_id,
      s.expires_at,
      u.id,
      u.name,
      u.email,
      u.plan,
      u.status,
      u.created_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
  `).get(sessionToken);

  if (!session) {
    return null;
  }

  if (
    session.expires_at &&
    Number(session.expires_at) <= Date.now()
  ) {
    db.prepare(`
      DELETE FROM sessions
      WHERE token = ?
    `).run(sessionToken);

    return null;
  }

  return {
    id: session.id,
    name: session.name,
    email: session.email,
    plan: session.plan,
    status: session.status,
    created_at: session.created_at,
    token: session.token
  };
}

function requireAuth(req, res, next) {
  const account = currentAccount(req);

  if (!account) {
    return res.status(401).json({
      ok: false,
      error: "Não autenticado."
    });
  }

  if (account.status !== "active") {
    return res.status(403).json({
      ok: false,
      error: "Conta indisponível."
    });
  }

  req.account = account;
  next();
}

function audit(action, userId = null, details = null) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (
        id,
        user_id,
        action,
        details,
        created_at
      )
      VALUES (?, ?, ?, ?, ?)
    `).run(
      id(),
      userId,
      action,
      details ? JSON.stringify(details) : null,
      now()
    );
  } catch (error) {
    console.error("Falha na auditoria:", error.message);
  }
}

/* =========================================================
   HEALTH
========================================================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "resgata-platform",
    version: "3.1.0",
    database: true,
    databasePath: dbPath
  });
});

/* =========================================================
   SERVIÇOS
========================================================= */

app.get("/api/services", (req, res) => {
  const services = db.prepare(`
    SELECT
      id,
      name,
      description,
      category,
      enabled,
      client_visible AS clientVisible
    FROM services
    WHERE enabled = 1
      AND client_visible = 1
    ORDER BY name
  `).all();

  res.json({
    ok: true,
    services
  });
});

app.get("/api/admin/services", requireAdmin, (req, res) => {
  const services = db.prepare(`
    SELECT
      id,
      name,
      description,
      category,
      enabled,
      client_visible AS clientVisible
    FROM services
    ORDER BY name
  `).all();

  res.json({
    ok: true,
    services
  });
});

app.patch("/api/admin/services/:id", requireAdmin, (req, res) => {
  const service = db.prepare(`
    SELECT id
    FROM services
    WHERE id = ?
  `).get(req.params.id);

  if (!service) {
    return res.status(404).json({
      ok: false,
      error: "Serviço não encontrado."
    });
  }

  const enabled =
    typeof req.body?.enabled === "boolean"
      ? req.body.enabled ? 1 : 0
      : undefined;

  const clientVisible =
    typeof req.body?.clientVisible === "boolean"
      ? req.body.clientVisible ? 1 : 0
      : undefined;

  if (enabled === undefined && clientVisible === undefined) {
    return res.status(400).json({
      ok: false,
      error: "Nenhuma alteração informada."
    });
  }

  if (
    enabled !== undefined &&
    clientVisible !== undefined
  ) {
    db.prepare(`
      UPDATE services
      SET
        enabled = ?,
        client_visible = ?
      WHERE id = ?
    `).run(
      enabled,
      clientVisible,
      req.params.id
    );
  } else if (enabled !== undefined) {
    db.prepare(`
      UPDATE services
      SET enabled = ?
      WHERE id = ?
    `).run(
      enabled,
      req.params.id
    );
  } else {
    db.prepare(`
      UPDATE services
      SET client_visible = ?
      WHERE id = ?
    `).run(
      clientVisible,
      req.params.id
    );
  }

  audit("admin_service_updated", null, {
    serviceId: req.params.id
  });

  const updated = db.prepare(`
    SELECT
      id,
      name,
      description,
      category,
      enabled,
      client_visible AS clientVisible
    FROM services
    WHERE id = ?
  `).get(req.params.id);

  res.json({
    ok: true,
    service: updated
  });
});

/* =========================================================
   ATUALIZAÇÕES
========================================================= */

app.get("/api/updates", (req, res) => {
  const updates = db.prepare(`
    SELECT
      version,
      type,
      description,
      status,
      created_at AS createdAt
    FROM updates
    ORDER BY created_at DESC
  `).all();

  res.json({
    ok: true,
    updates
  });
});

/* =========================================================
   CADASTRO
========================================================= */

app.post("/api/auth/register", (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!name || !email || !password) {
      return res.status(400).json({
        ok: false,
        error: "Nome, e-mail e senha são obrigatórios."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        ok: false,
        error: "A senha deve ter pelo menos 6 caracteres."
      });
    }

    const existing = db.prepare(`
      SELECT id
      FROM users
      WHERE email = ?
    `).get(email);

    if (existing) {
      return res.status(409).json({
        ok: false,
        error: "Este e-mail já está cadastrado."
      });
    }

    const userId = id();
    const sessionToken = token();
    const createdAt = now();
    const expiresAt = String(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    );

    const insertUser = db.prepare(`
      INSERT INTO users (
        id,
        name,
        email,
        password,
        plan,
        status,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertSession = db.prepare(`
      INSERT INTO sessions (
        token,
        user_id,
        created_at,
        expires_at
      )
      VALUES (?, ?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      insertUser.run(
        userId,
        name,
        email,
        password,
        "free",
        "active",
        createdAt
      );

      insertSession.run(
        sessionToken,
        userId,
        createdAt,
        expiresAt
      );
    });

    transaction();

    audit("user_registered", userId, {
      email
    });

    res.status(201).json({
      ok: true,
      token: sessionToken,
      user: {
        id: userId,
        name,
        email,
        plan: "free",
        status: "active",
        created_at: createdAt
      }
    });
  } catch (error) {
    console.error("Erro no cadastro:", error);

    res.status(500).json({
      ok: false,
      error: "Erro interno da Central Resgata+."
    });
  }
});

/* =========================================================
   LOGIN
========================================================= */

app.post("/api/auth/login", (req, res) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();

    const password = String(req.body?.password || "");

    const user = db.prepare(`
      SELECT
        id,
        name,
        email,
        password,
        plan,
        status,
        created_at
      FROM users
      WHERE email = ?
    `).get(email);

    if (!user || user.password !== password) {
      return res.status(401).json({
        ok: false,
        error: "E-mail ou senha inválidos."
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        ok: false,
        error: "Conta indisponível."
      });
    }

    const sessionToken = token();
    const createdAt = now();
    const expiresAt = String(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    );

    db.prepare(`
      INSERT INTO sessions (
        token,
        user_id,
        created_at,
        expires_at
      )
      VALUES (?, ?, ?, ?)
    `).run(
      sessionToken,
      user.id,
      createdAt,
      expiresAt
    );

    audit("user_login", user.id);

    res.json({
      ok: true,
      token: sessionToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        status: user.status,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error("Erro no login:", error);

    res.status(500).json({
      ok: false,
      error: "Erro interno da Central Resgata+."
    });
  }
});

/* =========================================================
   LOGOUT
========================================================= */

app.post("/api/auth/logout", requireAuth, (req, res) => {
  const sessionToken = getBearerToken(req);

  db.prepare(`
    DELETE FROM sessions
    WHERE token = ?
  `).run(sessionToken);

  audit("user_logout", req.account.id);

  res.json({
    ok: true
  });
});

/* =========================================================
   CONTA
========================================================= */

app.get("/api/account", requireAuth, (req, res) => {
  res.json({
    ok: true,
    user: {
      id: req.account.id,
      name: req.account.name,
      email: req.account.email,
      plan: req.account.plan,
      status: req.account.status,
      created_at: req.account.created_at
    }
  });
});

/* =========================================================
   DISPOSITIVOS
========================================================= */

app.get("/api/devices", requireAuth, (req, res) => {
  const devices = db.prepare(`
    SELECT
      id,
      device_id AS deviceId,
      name,
      model,
      android_version AS androidVersion,
      app_version AS appVersion,
      last_seen AS lastSeen,
      status
    FROM devices
    WHERE user_id = ?
    ORDER BY last_seen DESC
  `).all(req.account.id);

  res.json({
    ok: true,
    devices
  });
});

app.post("/api/devices", requireAuth, (req, res) => {
  try {
    const deviceId = String(req.body?.deviceId || "").trim();
    const name = String(req.body?.name || "").trim();
    const model = String(req.body?.model || "").trim();
    const androidVersion = String(
      req.body?.androidVersion || ""
    ).trim();
    const appVersion = String(
      req.body?.appVersion || ""
    ).trim();

    if (!deviceId) {
      return res.status(400).json({
        ok: false,
        error: "deviceId é obrigatório."
      });
    }

    const existing = db.prepare(`
      SELECT id
      FROM devices
      WHERE user_id = ?
        AND device_id = ?
    `).get(
      req.account.id,
      deviceId
    );

    const timestamp = now();

    if (existing) {
      db.prepare(`
        UPDATE devices
        SET
          name = ?,
          model = ?,
          android_version = ?,
          app_version = ?,
          last_seen = ?,
          status = ?
        WHERE id = ?
      `).run(
        name,
        model,
        androidVersion,
        appVersion,
        timestamp,
        "online",
        existing.id
      );

      return res.json({
        ok: true,
        deviceId: existing.id,
        updated: true
      });
    }

    const deviceRecordId = id();

    db.prepare(`
      INSERT INTO devices (
        id,
        user_id,
        device_id,
        name,
        model,
        android_version,
        app_version,
        last_seen,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      deviceRecordId,
      req.account.id,
      deviceId,
      name,
      model,
      androidVersion,
      appVersion,
      timestamp,
      "online"
    );

    audit("device_registered", req.account.id, {
      deviceId
    });

    res.status(201).json({
      ok: true,
      deviceId: deviceRecordId
    });
  } catch (error) {
    console.error("Erro no dispositivo:", error);

    res.status(500).json({
      ok: false,
      error: "Erro interno da Central Resgata+."
    });
  }
});

/* =========================================================
   SUPORTE
========================================================= */

app.post("/api/support/tickets", requireAuth, (req, res) => {
  try {
    const subject = String(req.body?.subject || "").trim();
    const message = String(req.body?.message || "").trim();

    if (!subject || !message) {
      return res.status(400).json({
        ok: false,
        error: "Assunto e mensagem são obrigatórios."
      });
    }

    const ticketId = id();
    const createdAt = now();

    db.prepare(`
      INSERT INTO tickets (
        id,
        user_id,
        subject,
        message,
        status,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      ticketId,
      req.account.id,
      subject,
      message,
      "open",
      createdAt
    );

    audit("support_ticket_created", req.account.id, {
      ticketId
    });

    res.status(201).json({
      ok: true,
      ticket: {
        id: ticketId,
        subject,
        message,
        status: "open",
        created_at: createdAt
      }
    });
  } catch (error) {
    console.error("Erro no ticket:", error);

    res.status(500).json({
      ok: false,
      error: "Erro interno da Central Resgata+."
    });
  }
});

app.get("/api/support", requireAuth, (req, res) => {
  const tickets = db.prepare(`
    SELECT
      id,
      subject,
      message,
      status,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM tickets
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(req.account.id);

  res.json({
    ok: true,
    tickets
  });
});

/* =========================================================
   SOLICITAÇÕES DE SERVIÇO
========================================================= */

app.post("/api/service-requests", requireAuth, (req, res) => {
  try {
    const serviceId = String(
      req.body?.serviceId || ""
    ).trim();

    const description = String(
      req.body?.description || ""
    ).trim();

    if (!serviceId || !description) {
      return res.status(400).json({
        ok: false,
        error: "serviceId e description são obrigatórios."
      });
    }

    const service = db.prepare(`
      SELECT id, name
      FROM services
      WHERE id = ?
        AND enabled = 1
        AND client_visible = 1
    `).get(serviceId);

    if (!service) {
      return res.status(404).json({
        ok: false,
        error: "Serviço indisponível."
      });
    }

    const requestId = id();
    const createdAt = now();

    db.prepare(`
      INSERT INTO service_requests (
        id,
        user_id,
        service_id,
        description,
        status,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      requestId,
      req.account.id,
      serviceId,
      description,
      "open",
      createdAt
    );

    audit("service_request_created", req.account.id, {
      requestId,
      serviceId
    });

    res.status(201).json({
      ok: true,
      request: {
        id: requestId,
        serviceId,
        serviceName: service.name,
        description,
        status: "open",
        created_at: createdAt
      }
    });
  } catch (error) {
    console.error("Erro na solicitação:", error);

    res.status(500).json({
      ok: false,
      error: "Erro interno da Central Resgata+."
    });
  }
});

app.get("/api/service-requests", requireAuth, (req, res) => {
  const requests = db.prepare(`
    SELECT
      sr.id,
      sr.service_id AS serviceId,
      s.name AS serviceName,
      sr.description,
      sr.status,
      sr.created_at AS createdAt,
      sr.updated_at AS updatedAt
    FROM service_requests sr
    LEFT JOIN services s
      ON s.id = sr.service_id
    WHERE sr.user_id = ?
    ORDER BY sr.created_at DESC
  `).all(req.account.id);

  res.json({
    ok: true,
    requests
  });
});

/* =========================================================
   DIAGNÓSTICOS
========================================================= */

app.post("/api/diagnostics", requireAuth, (req, res) => {
  try {
    const diagnosticId = id();
    const deviceId = req.body?.deviceId ?? null;
    const type = String(
      req.body?.type || "geral"
    ).trim();
    const resultData = req.body?.result ?? {};
    const createdAt = now();

    db.prepare(`
      INSERT INTO diagnostics (
        id,
        user_id,
        device_id,
        type,
        result,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      diagnosticId,
      req.account.id,
      deviceId,
      type,
      JSON.stringify(resultData),
      createdAt
    );

    audit("diagnostic_received", req.account.id, {
      diagnosticId,
      deviceId,
      type
    });

    res.status(201).json({
      ok: true,
      diagnostic: {
        id: diagnosticId,
        deviceId,
        type,
        result: resultData,
        created_at: createdAt
      }
    });
  } catch (error) {
    console.error("Erro no diagnóstico:", error);

    res.status(500).json({
      ok: false,
      error: "Erro interno da Central Resgata+."
    });
  }
});

/* =========================================================
   ADMIN
========================================================= */

app.get("/api/admin/users", requireAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT
      id,
      name,
      email,
      plan,
      status,
      created_at AS createdAt
    FROM users
    ORDER BY created_at DESC
  `).all();

  res.json({
    ok: true,
    users
  });
});

app.get("/api/admin/tickets", requireAdmin, (req, res) => {
  const tickets = db.prepare(`
    SELECT
      t.id,
      t.user_id AS userId,
      u.name AS userName,
      u.email AS userEmail,
      t.subject,
      t.message,
      t.status,
      t.created_at AS createdAt,
      t.updated_at AS updatedAt
    FROM tickets t
    LEFT JOIN users u
      ON u.id = t.user_id
    ORDER BY t.created_at DESC
  `).all();

  res.json({
    ok: true,
    tickets
  });
});

app.use("/api/admin/devices", requireAdmin, adminDevicesRoutes);
app.use("/api/admin/services", requireAdmin, adminServicesRoutes);

app.get("/api/admin/devices", requireAdmin, (req, res) => {
  const devices = db.prepare(`
    SELECT
      d.id,
      d.user_id AS userId,
      u.name AS userName,
      u.email AS userEmail,
      d.id AS deviceId,
      d.name,
      d.model,
      d.android_version AS androidVersion,
      d.app_version AS appVersion,
      d.last_seen AS lastSeen,
      d.status
    FROM devices d
    LEFT JOIN users u
      ON u.id = d.user_id
    ORDER BY d.last_seen DESC
  `).all();

  res.json({
    ok: true,
    devices
  });
});


/* =========================================================
   DASHBOARD ADMIN
========================================================= */

app.get("/api/admin/dashboard", requireAdmin, (req, res) => {
  try {
    const dashboard = {
      users: {
        total: db.prepare(`
          SELECT COUNT(*) AS total
          FROM users
        `).get().total,

        active: db.prepare(`
          SELECT COUNT(*) AS total
          FROM users
          WHERE status = 'active'
        `).get().total
      },

      devices: {
        total: db.prepare(`
          SELECT COUNT(*) AS total
          FROM devices
        `).get().total,

        active: db.prepare(`
          SELECT COUNT(*) AS total
          FROM devices
          WHERE status = 'active'
        `).get().total
      },

      services: {
        total: db.prepare(`
          SELECT COUNT(*) AS total
          FROM services
        `).get().total,

        active: db.prepare(`
          SELECT COUNT(*) AS total
          FROM services
          WHERE enabled = 1
        `).get().total
      },

      requests: {
        total: db.prepare(`
          SELECT COUNT(*) AS total
          FROM service_requests
        `).get().total
      },

      tickets: {
        total: db.prepare(`
          SELECT COUNT(*) AS total
          FROM tickets
        `).get().total,

        open: db.prepare(`
          SELECT COUNT(*) AS total
          FROM tickets
          WHERE status IN ('open', 'pending', 'in_progress')
        `).get().total
      },

      updates: {
        total: db.prepare(`
          SELECT COUNT(*) AS total
          FROM updates
        `).get().total
      },

      notifications: {
        total: db.prepare(`
          SELECT COUNT(*) AS total
          FROM notifications
        `).get().total
      },

      audit: {
        total: db.prepare(`
          SELECT COUNT(*) AS total
          FROM audit_logs
        `).get().total,

        recent: db.prepare(`
          SELECT
            id,
            action,
            entity,
            entity_id AS entityId,
            details,
            created_at AS createdAt
          FROM audit_logs
          ORDER BY id DESC
          LIMIT 10
        `).all()
      }
    };

    return res.json({
      ok: true,
      dashboard
    });
  } catch (error) {
    console.error("ADMIN DASHBOARD ERROR:", error);

    return res.status(500).json({
      ok: false,
      error: "ADMIN_DASHBOARD_ERROR"
    });
  }
});

/* =========================================================
   ERROS
========================================================= */

app.use((err, req, res, next) => {
  console.error("Erro na API:", err);

  res.status(500).json({
    ok: false,
    error: "Erro interno da Central Resgata+."
  });
});

/* =========================================================
   CLIENTE / ADMIN
========================================================= */

const clientPath = path.join(__dirname, "..", "client");
const adminPath = path.join(__dirname, "..", "admin");

app.use("/admin", express.static(adminPath));
app.use(express.static(clientPath));

/* =========================================================
   START
========================================================= */

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Resgata+ Central V3.1 rodando na porta ${PORT}`
  );

  console.log(
    `Banco: ${dbPath}`
  );
});

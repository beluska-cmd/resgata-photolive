import express from "express";
import crypto from "node:crypto";
import { db } from "./database.js";

const router = express.Router();

function id() {
  return crypto.randomUUID();
}

function now() {
  return Date.now().toString();
}

function audit(req, action, entity, entityId, details = {}) {
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
    action,
    entity,
    entityId || null,
    JSON.stringify({
      adminId: req.admin?.id || null,
      ...details
    }),
    now()
  );
}

/*
 * LISTAR SERVIÇOS
 * GET /api/admin/services
 */
router.get("/", (req, res) => {
  try {
    const {
      search = "",
      status = "",
      category = "",
      limit = "500"
    } = req.query;

    const conditions = [];
    const params = [];

    if (search.trim()) {
      conditions.push(`
        (
          s.id LIKE ?
          OR s.name LIKE ?
          OR s.description LIKE ?
          OR s.category LIKE ?
        )
      `);

      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    if (status === "enabled") {
      conditions.push("s.enabled = 1");
    }

    if (status === "disabled") {
      conditions.push("s.enabled = 0");
    }

    if (category.trim()) {
      conditions.push("s.category = ?");
      params.push(category.trim());
    }

    const where = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const safeLimit = Math.min(
      Math.max(Number(limit) || 500, 1),
      500
    );

    const services = db.prepare(`
      SELECT
        s.id,
        s.name,
        s.description,
        s.category,
        s.enabled,
        s.client_visible AS clientVisible
      FROM services s
      ${where}
      ORDER BY s.category ASC, s.name ASC
      LIMIT ${safeLimit}
    `).all(...params);

    const total = db.prepare(`
      SELECT COUNT(*) AS total
      FROM services s
      ${where}
    `).get(...params).total;

    return res.json({
      ok: true,
      services,
      total
    });
  } catch (error) {
    console.error("ADMIN SERVICES LIST ERROR:", error);

    return res.status(500).json({
      ok: false,
      error: "ADMIN_SERVICES_LIST_ERROR"
    });
  }
});

/*
 * RESUMO
 * GET /api/admin/services/summary
 */
router.get("/summary", (req, res) => {
  try {
    const total = db.prepare(`
      SELECT COUNT(*) AS total
      FROM services
    `).get().total;

    const enabled = db.prepare(`
      SELECT COUNT(*) AS total
      FROM services
      WHERE enabled = 1
    `).get().total;

    const disabled = db.prepare(`
      SELECT COUNT(*) AS total
      FROM services
      WHERE enabled = 0
    `).get().total;

    const visible = db.prepare(`
      SELECT COUNT(*) AS total
      FROM services
      WHERE client_visible = 1
    `).get().total;

    const hidden = db.prepare(`
      SELECT COUNT(*) AS total
      FROM services
      WHERE client_visible = 0
    `).get().total;

    const categories = db.prepare(`
      SELECT
        category,
        COUNT(*) AS total
      FROM services
      GROUP BY category
      ORDER BY category ASC
    `).all();

    return res.json({
      ok: true,
      summary: {
        total,
        enabled,
        disabled,
        visible,
        hidden
      },
      categories
    });
  } catch (error) {
    console.error("ADMIN SERVICES SUMMARY ERROR:", error);

    return res.status(500).json({
      ok: false,
      error: "ADMIN_SERVICES_SUMMARY_ERROR"
    });
  }
});

/*
 * CRIAR SERVIÇO
 * POST /api/admin/services
 */
router.post("/", (req, res) => {
  try {
    const {
      name,
      description = "",
      category = "Outros",
      enabled = true,
      clientVisible = true
    } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        ok: false,
        error: "SERVICE_NAME_REQUIRED"
      });
    }

    const serviceId = id();

    db.prepare(`
      INSERT INTO services (
        id,
        name,
        description,
        category,
        enabled,
        client_visible
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      serviceId,
      String(name).trim(),
      String(description).trim(),
      String(category).trim() || "Outros",
      enabled ? 1 : 0,
      clientVisible ? 1 : 0
    );

    audit(
      req,
      "admin.service_created",
      "service",
      serviceId,
      {
        name: String(name).trim()
      }
    );

    const service = db.prepare(`
      SELECT
        id,
        name,
        description,
        category,
        enabled,
        client_visible AS clientVisible
      FROM services
      WHERE id = ?
    `).get(serviceId);

    return res.status(201).json({
      ok: true,
      service
    });
  } catch (error) {
    console.error("ADMIN SERVICE CREATE ERROR:", error);

    return res.status(500).json({
      ok: false,
      error: "ADMIN_SERVICE_CREATE_ERROR"
    });
  }
});

/*
 * DETALHES
 * GET /api/admin/services/:id
 */
router.get("/:id", (req, res) => {
  try {
    const service = db.prepare(`
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

    if (!service) {
      return res.status(404).json({
        ok: false,
        error: "SERVICE_NOT_FOUND"
      });
    }

    const requests = db.prepare(`
      SELECT
        COUNT(*) AS total
      FROM service_requests
      WHERE service_id = ?
    `).get(req.params.id).total;

    return res.json({
      ok: true,
      service,
      usage: {
        requests
      }
    });
  } catch (error) {
    console.error("ADMIN SERVICE DETAIL ERROR:", error);

    return res.status(500).json({
      ok: false,
      error: "ADMIN_SERVICE_DETAIL_ERROR"
    });
  }
});

/*
 * EDITAR
 * PATCH /api/admin/services/:id
 */
router.patch("/:id", (req, res) => {
  try {
    const current = db.prepare(`
      SELECT *
      FROM services
      WHERE id = ?
    `).get(req.params.id);

    if (!current) {
      return res.status(404).json({
        ok: false,
        error: "SERVICE_NOT_FOUND"
      });
    }

    const {
      name,
      description,
      category,
      enabled,
      clientVisible
    } = req.body || {};

    const nextName =
      name !== undefined ? String(name).trim() : current.name;

    const nextDescription =
      description !== undefined
        ? String(description).trim()
        : current.description;

    const nextCategory =
      category !== undefined
        ? String(category).trim()
        : current.category;

    const nextEnabled =
      enabled !== undefined
        ? (enabled ? 1 : 0)
        : current.enabled;

    const nextVisible =
      clientVisible !== undefined
        ? (clientVisible ? 1 : 0)
        : current.client_visible;

    if (!nextName) {
      return res.status(400).json({
        ok: false,
        error: "SERVICE_NAME_REQUIRED"
      });
    }

    db.prepare(`
      UPDATE services
      SET
        name = ?,
        description = ?,
        category = ?,
        enabled = ?,
        client_visible = ?
      WHERE id = ?
    `).run(
      nextName,
      nextDescription,
      nextCategory || "Outros",
      nextEnabled,
      nextVisible,
      req.params.id
    );

    audit(
      req,
      "admin.service_updated",
      "service",
      req.params.id,
      {
        before: {
          name: current.name,
          description: current.description,
          category: current.category,
          enabled: current.enabled,
          clientVisible: current.client_visible
        },
        after: {
          name: nextName,
          description: nextDescription,
          category: nextCategory || "Outros",
          enabled: nextEnabled,
          clientVisible: nextVisible
        }
      }
    );

    const service = db.prepare(`
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

    return res.json({
      ok: true,
      service
    });
  } catch (error) {
    console.error("ADMIN SERVICE UPDATE ERROR:", error);

    return res.status(500).json({
      ok: false,
      error: "ADMIN_SERVICE_UPDATE_ERROR"
    });
  }
});

/*
 * ATIVAR / DESATIVAR
 * PATCH /api/admin/services/:id/status
 */
router.patch("/:id/status", (req, res) => {
  try {
    const { enabled } = req.body || {};

    if (typeof enabled !== "boolean") {
      return res.status(400).json({
        ok: false,
        error: "ENABLED_BOOLEAN_REQUIRED"
      });
    }

    const service = db.prepare(`
      SELECT *
      FROM services
      WHERE id = ?
    `).get(req.params.id);

    if (!service) {
      return res.status(404).json({
        ok: false,
        error: "SERVICE_NOT_FOUND"
      });
    }

    db.prepare(`
      UPDATE services
      SET enabled = ?
      WHERE id = ?
    `).run(
      enabled ? 1 : 0,
      req.params.id
    );

    audit(
      req,
      enabled
        ? "admin.service_enabled"
        : "admin.service_disabled",
      "service",
      req.params.id,
      {
        previous: Boolean(service.enabled),
        enabled
      }
    );

    return res.json({
      ok: true,
      serviceId: req.params.id,
      enabled
    });
  } catch (error) {
    console.error("ADMIN SERVICE STATUS ERROR:", error);

    return res.status(500).json({
      ok: false,
      error: "ADMIN_SERVICE_STATUS_ERROR"
    });
  }
});

/*
 * VISIBILIDADE PARA CLIENTE
 * PATCH /api/admin/services/:id/visibility
 */
router.patch("/:id/visibility", (req, res) => {
  try {
    const { clientVisible } = req.body || {};

    if (typeof clientVisible !== "boolean") {
      return res.status(400).json({
        ok: false,
        error: "CLIENT_VISIBLE_BOOLEAN_REQUIRED"
      });
    }

    const service = db.prepare(`
      SELECT *
      FROM services
      WHERE id = ?
    `).get(req.params.id);

    if (!service) {
      return res.status(404).json({
        ok: false,
        error: "SERVICE_NOT_FOUND"
      });
    }

    db.prepare(`
      UPDATE services
      SET client_visible = ?
      WHERE id = ?
    `).run(
      clientVisible ? 1 : 0,
      req.params.id
    );

    audit(
      req,
      "admin.service_visibility_changed",
      "service",
      req.params.id,
      {
        previous: Boolean(service.client_visible),
        clientVisible
      }
    );

    return res.json({
      ok: true,
      serviceId: req.params.id,
      clientVisible
    });
  } catch (error) {
    console.error("ADMIN SERVICE VISIBILITY ERROR:", error);

    return res.status(500).json({
      ok: false,
      error: "ADMIN_SERVICE_VISIBILITY_ERROR"
    });
  }
});

export default router;

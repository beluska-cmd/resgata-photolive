import express from "express";
import crypto from "node:crypto";
import { db } from "./database.js";

const router = express.Router();

function now() {
  return new Date().toISOString();
}

function audit(req, action, entityId, details = {}) {
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
    "service_request",
    entityId || null,
    JSON.stringify({
      adminId: req.admin?.id || null,
      ...details
    }),
    now()
  );
}

function parseDetails(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return {
      text: String(value)
    };
  }
}

/*
 * GET /api/admin/requests
 *
 * Lista solicitações com filtros administrativos.
 */
router.get("/", (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").trim();
    const serviceId = String(req.query.serviceId || "").trim();

    const conditions = [];
    const params = {};

    if (search) {
      conditions.push(`
        (
          sr.id LIKE @search
          OR u.name LIKE @search
          OR u.email LIKE @search
          OR s.name LIKE @search
          OR sr.service_id LIKE @search
        )
      `);

      params.search = `%${search}%`;
    }

    if (status) {
      conditions.push("sr.status = @status");
      params.status = status;
    }

    if (serviceId) {
      conditions.push("sr.service_id = @serviceId");
      params.serviceId = serviceId;
    }

    const where = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const requests = db.prepare(`
      SELECT
        sr.id,
        sr.user_id,
        sr.service_id,
        sr.device_id,
        sr.status,
        sr.details,
        sr.created_at,
        sr.updated_at,

        u.name AS user_name,
        u.email AS user_email,
        u.plan AS user_plan,
        u.status AS user_status,

        s.name AS service_name,
        s.category AS service_category,

        d.name AS device_name,
        d.model AS device_model,
        d.android_version,
        d.app_version,
        d.status AS device_status

      FROM service_requests sr

      LEFT JOIN users u
        ON u.id = sr.user_id

      LEFT JOIN services s
        ON s.id = sr.service_id

      LEFT JOIN devices d
        ON d.id = sr.device_id

      ${where}

      ORDER BY sr.created_at DESC
      LIMIT 500
    `).all(params);

    const normalized = requests.map(request => ({
      ...request,
      details: parseDetails(request.details)
    }));

    return res.json({
      ok: true,
      requests: normalized,
      total: normalized.length
    });
  } catch (error) {
    console.error("ADMIN REQUESTS LIST ERROR:", error);

    return res.status(500).json({
      ok: false,
      error: "ADMIN_REQUESTS_LIST_ERROR"
    });
  }
});

/*
 * GET /api/admin/requests/summary
 *
 * Resumo das solicitações.
 */
router.get("/summary", (req, res) => {
  try {
    const total = db.prepare(`
      SELECT COUNT(*) AS total
      FROM service_requests
    `).get();

    const byStatus = db.prepare(`
      SELECT
        status,
        COUNT(*) AS total
      FROM service_requests
      GROUP BY status
      ORDER BY total DESC
    `).all();

    const byService = db.prepare(`
      SELECT
        sr.service_id,
        COALESCE(s.name, sr.service_id) AS service_name,
        COUNT(*) AS total
      FROM service_requests sr
      LEFT JOIN services s
        ON s.id = sr.service_id
      GROUP BY sr.service_id
      ORDER BY total DESC
    `).all();

    return res.json({
      ok: true,
      summary: {
        total: total.total || 0,
        byStatus,
        byService
      }
    });
  } catch (error) {
    console.error("ADMIN REQUESTS SUMMARY ERROR:", error);

    return res.status(500).json({
      ok: false,
      error: "ADMIN_REQUESTS_SUMMARY_ERROR"
    });
  }
});

/*
 * GET /api/admin/requests/:id
 *
 * Detalhes completos de uma solicitação.
 */
router.get("/:id", (req, res) => {
  try {
    const request = db.prepare(`
      SELECT
        sr.id,
        sr.user_id,
        sr.service_id,
        sr.device_id,
        sr.status,
        sr.details,
        sr.created_at,
        sr.updated_at,

        u.name AS user_name,
        u.email AS user_email,
        u.plan AS user_plan,
        u.status AS user_status,
        u.created_at AS user_created_at,

        s.name AS service_name,
        s.description AS service_description,
        s.category AS service_category,
        s.enabled AS service_enabled,
        s.client_visible AS service_client_visible,

        d.name AS device_name,
        d.model AS device_model,
        d.android_version,
        d.app_version,
        d.last_seen,
        d.status AS device_status

      FROM service_requests sr

      LEFT JOIN users u
        ON u.id = sr.user_id

      LEFT JOIN services s
        ON s.id = sr.service_id

      LEFT JOIN devices d
        ON d.id = sr.device_id

      WHERE sr.id = ?
    `).get(req.params.id);

    if (!request) {
      return res.status(404).json({
        ok: false,
        error: "REQUEST_NOT_FOUND"
      });
    }

    const auditLogs = db.prepare(`
      SELECT
        id,
        action,
        entity,
        entity_id,
        details,
        created_at
      FROM audit_logs
      WHERE entity = 'service_request'
        AND entity_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `).all(req.params.id);

    return res.json({
      ok: true,
      request: {
        ...request,
        details: parseDetails(request.details)
      },
      audit: auditLogs.map(log => ({
        ...log,
        details: parseDetails(log.details)
      }))
    });
  } catch (error) {
    console.error("ADMIN REQUEST DETAIL ERROR:", error);

    return res.status(500).json({
      ok: false,
      error: "ADMIN_REQUEST_DETAIL_ERROR"
    });
  }
});

/*
 * PATCH /api/admin/requests/:id/status
 */
router.patch("/:id/status", (req, res) => {
  try {
    const allowedStatuses = [
      "pending",
      "received",
      "in_progress",
      "waiting_user",
      "waiting_specialist",
      "resolved",
      "cancelled",
      "rejected"
    ];

    const status = String(req.body?.status || "").trim();

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_REQUEST_STATUS",
        allowedStatuses
      });
    }

    const request = db.prepare(`
      SELECT *
      FROM service_requests
      WHERE id = ?
    `).get(req.params.id);

    if (!request) {
      return res.status(404).json({
        ok: false,
        error: "REQUEST_NOT_FOUND"
      });
    }

    const previousStatus = request.status;

    db.prepare(`
      UPDATE service_requests
      SET
        status = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      status,
      now(),
      req.params.id
    );

    audit(
      req,
      "admin.request.status_updated",
      req.params.id,
      {
        previousStatus,
        status
      }
    );

    const updated = db.prepare(`
      SELECT *
      FROM service_requests
      WHERE id = ?
    `).get(req.params.id);

    return res.json({
      ok: true,
      request: {
        ...updated,
        details: parseDetails(updated.details)
      }
    });
  } catch (error) {
    console.error("ADMIN REQUEST STATUS ERROR:", error);

    return res.status(500).json({
      ok: false,
      error: "ADMIN_REQUEST_STATUS_ERROR"
    });
  }
});

/*
 * PATCH /api/admin/requests/:id/details
 *
 * Atualiza os detalhes administrativos da solicitação.
 *
 * Importante:
 * este endpoint não permite alterar user_id,
 * device_id ou service_id.
 */
router.patch("/:id/details", (req, res) => {
  try {
    const request = db.prepare(`
      SELECT *
      FROM service_requests
      WHERE id = ?
    `).get(req.params.id);

    if (!request) {
      return res.status(404).json({
        ok: false,
        error: "REQUEST_NOT_FOUND"
      });
    }

    const details =
      req.body?.details;

    if (
      details === undefined ||
      details === null
    ) {
      return res.status(400).json({
        ok: false,
        error: "DETAILS_REQUIRED"
      });
    }

    const serialized =
      typeof details === "string"
        ? details
        : JSON.stringify(details);

    if (serialized.length > 20000) {
      return res.status(400).json({
        ok: false,
        error: "DETAILS_TOO_LARGE"
      });
    }

    db.prepare(`
      UPDATE service_requests
      SET
        details = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      serialized,
      now(),
      req.params.id
    );

    audit(
      req,
      "admin.request.details_updated",
      req.params.id,
      {
        previousLength: String(request.details || "").length,
        newLength: serialized.length
      }
    );

    const updated = db.prepare(`
      SELECT *
      FROM service_requests
      WHERE id = ?
    `).get(req.params.id);

    return res.json({
      ok: true,
      request: {
        ...updated,
        details: parseDetails(updated.details)
      }
    });
  } catch (error) {
    console.error("ADMIN REQUEST DETAILS ERROR:", error);

    return res.status(500).json({
      ok: false,
      error: "ADMIN_REQUEST_DETAILS_ERROR"
    });
  }
});

export default router;

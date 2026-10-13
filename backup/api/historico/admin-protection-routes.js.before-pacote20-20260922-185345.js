import express from "express";
import crypto from "crypto";
import db from "./database.js";

const router = express.Router();

function audit(adminId, action, entity, entityId, details = {}) {
  db.prepare(`
    INSERT INTO audit_logs
    (user_id, action, entity, entity_id, details)
    VALUES (NULL, ?, ?, ?, ?)
  `).run(
    action,
    entity,
    String(entityId || ""),
    JSON.stringify({
      adminId,
      ...details
    })
  );
}

router.get("/categories", (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT *
      FROM protection_categories
      ORDER BY name ASC
    `).all();

    res.json({
      ok: true,
      categories
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "PROTECTION_CATEGORIES_ERROR"
    });
  }
});

router.patch("/categories/:id", (req, res) => {
  const allowed = [0, 1, true, false];

  if (!allowed.includes(req.body?.active)) {
    return res.status(400).json({
      ok: false,
      error: "INVALID_ACTIVE"
    });
  }

  const result = db.prepare(`
    UPDATE protection_categories
    SET
      active = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    req.body.active ? 1 : 0,
    req.params.id
  );

  if (!result.changes) {
    return res.status(404).json({
      ok: false,
      error: "CATEGORY_NOT_FOUND"
    });
  }

  audit(
    req.admin.id,
    "admin.protection.category_updated",
    "protection_category",
    req.params.id,
    {
      active: Boolean(req.body.active)
    }
  );

  res.json({
    ok: true,
    active: Boolean(req.body.active)
  });
});

router.get("/rules", (req, res) => {
  try {
    const rules = db.prepare(`
      SELECT
        r.*,
        c.name AS category_name,
        c.slug AS category_slug
      FROM protection_rules r
      LEFT JOIN protection_categories c
        ON c.id = r.category_id
      ORDER BY r.created_at DESC
    `).all();

    res.json({
      ok: true,
      rules
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "PROTECTION_RULES_ERROR"
    });
  }
});

router.post("/rules", (req, res) => {
  try {
    const {
      categoryId = null,
      name,
      description = "",
      pattern = "",
      action = "warn",
      severity = "medium"
    } = req.body || {};

    if (!name) {
      return res.status(400).json({
        ok: false,
        error: "NAME_REQUIRED"
      });
    }

    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO protection_rules
      (
        id,
        category_id,
        name,
        description,
        pattern,
        action,
        severity,
        active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      id,
      categoryId,
      String(name),
      String(description),
      String(pattern),
      String(action),
      String(severity)
    );

    audit(
      req.admin.id,
      "admin.protection.rule_created",
      "protection_rule",
      id,
      { name }
    );

    res.status(201).json({
      ok: true,
      id
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "PROTECTION_RULE_CREATE_ERROR"
    });
  }
});

router.patch("/rules/:id", (req, res) => {
  const updates = [];
  const values = [];

  const fields = [
    "name",
    "description",
    "pattern",
    "action",
    "severity"
  ];

  for (const field of fields) {
    if (req.body?.[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(String(req.body[field]));
    }
  }

  if (req.body?.active !== undefined) {
    updates.push("active = ?");
    values.push(req.body.active ? 1 : 0);
  }

  if (!updates.length) {
    return res.status(400).json({
      ok: false,
      error: "NO_CHANGES"
    });
  }

  updates.push("updated_at = CURRENT_TIMESTAMP");
  values.push(req.params.id);

  const result = db.prepare(`
    UPDATE protection_rules
    SET ${updates.join(", ")}
    WHERE id = ?
  `).run(...values);

  if (!result.changes) {
    return res.status(404).json({
      ok: false,
      error: "RULE_NOT_FOUND"
    });
  }

  audit(
    req.admin.id,
    "admin.protection.rule_updated",
    "protection_rule",
    req.params.id,
    {
      fields: Object.keys(req.body || {})
    }
  );

  res.json({
    ok: true
  });
});

router.get("/reports", (req, res) => {
  try {
    const {
      status = "",
      category = "",
      severity = ""
    } = req.query;

    let sql = `
      SELECT *
      FROM protection_reports
      WHERE 1=1
    `;

    const params = {};

    if (status) {
      sql += ` AND status = @status`;
      params.status = status;
    }

    if (category) {
      sql += ` AND category = @category`;
      params.category = category;
    }

    if (severity) {
      sql += ` AND severity = @severity`;
      params.severity = severity;
    }

    sql += `
      ORDER BY created_at DESC
      LIMIT 500
    `;

    const reports = db.prepare(sql).all(params);

    res.json({
      ok: true,
      reports
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "PROTECTION_REPORTS_ERROR"
    });
  }
});

router.get("/reports/summary", (req, res) => {
  try {
    const total = db.prepare(`
      SELECT COUNT(*) AS total
      FROM protection_reports
    `).get().total;

    const open = db.prepare(`
      SELECT COUNT(*) AS total
      FROM protection_reports
      WHERE status = 'open'
    `).get().total;

    const high = db.prepare(`
      SELECT COUNT(*) AS total
      FROM protection_reports
      WHERE severity = 'high'
    `).get().total;

    res.json({
      ok: true,
      summary: {
        total,
        open,
        high
      }
    });
  } catch {
    res.status(500).json({
      ok: false,
      error: "PROTECTION_REPORTS_SUMMARY_ERROR"
    });
  }
});

router.patch("/reports/:id/status", (req, res) => {
  const allowed = [
    "open",
    "investigating",
    "resolved",
    "dismissed"
  ];

  if (!allowed.includes(req.body?.status)) {
    return res.status(400).json({
      ok: false,
      error: "INVALID_STATUS"
    });
  }

  const result = db.prepare(`
    UPDATE protection_reports
    SET
      status = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    req.body.status,
    req.params.id
  );

  if (!result.changes) {
    return res.status(404).json({
      ok: false,
      error: "REPORT_NOT_FOUND"
    });
  }

  audit(
    req.admin.id,
    "admin.protection.report_status_updated",
    "protection_report",
    req.params.id,
    {
      status: req.body.status
    }
  );

  res.json({
    ok: true
  });
});

router.get("/removal-requests", (req, res) => {
  try {
    const {
      status = ""
    } = req.query;

    let sql = `
      SELECT *
      FROM removal_requests
      WHERE 1=1
    `;

    const params = {};

    if (status) {
      sql += ` AND status = @status`;
      params.status = status;
    }

    sql += `
      ORDER BY created_at DESC
      LIMIT 500
    `;

    const requests = db.prepare(sql).all(params);

    res.json({
      ok: true,
      requests
    });
  } catch {
    res.status(500).json({
      ok: false,
      error: "REMOVAL_REQUESTS_ERROR"
    });
  }
});

router.patch("/removal-requests/:id/status", (req, res) => {
  const allowed = [
    "pending",
    "in_progress",
    "waiting_user",
    "completed",
    "failed",
    "cancelled"
  ];

  if (!allowed.includes(req.body?.status)) {
    return res.status(400).json({
      ok: false,
      error: "INVALID_STATUS"
    });
  }

  const result = db.prepare(`
    UPDATE removal_requests
    SET
      status = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    req.body.status,
    req.params.id
  );

  if (!result.changes) {
    return res.status(404).json({
      ok: false,
      error: "REMOVAL_REQUEST_NOT_FOUND"
    });
  }

  audit(
    req.admin.id,
    "admin.protection.removal_status_updated",
    "removal_request",
    req.params.id,
    {
      status: req.body.status
    }
  );

  res.json({
    ok: true
  });
});

export default router;

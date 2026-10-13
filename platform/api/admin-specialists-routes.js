import express from "express";
import crypto from "crypto";
import db from "./database.js";

const router = express.Router();

function audit(adminId, action, entityId, details = {}) {
  db.prepare(`
    INSERT INTO audit_logs
    (user_id, action, entity, entity_id, details)
    VALUES (NULL, ?, ?, ?, ?)
  `).run(
    action,
    "specialist",
    entityId,
    JSON.stringify({
      adminId,
      ...details
    })
  );
}

router.get("/", (req, res) => {
  try {
    const {
      search = "",
      status = "",
      availability = ""
    } = req.query;

    let sql = `
      SELECT
        id,
        name,
        email,
        phone,
        specialty,
        status,
        availability,
        notes,
        created_at,
        updated_at
      FROM specialists
      WHERE 1=1
    `;

    const params = {};

    if (search) {
      sql += `
        AND (
          name LIKE @search
          OR email LIKE @search
          OR specialty LIKE @search
        )
      `;

      params.search = `%${search}%`;
    }

    if (status) {
      sql += ` AND status = @status`;
      params.status = status;
    }

    if (availability) {
      sql += ` AND availability = @availability`;
      params.availability = availability;
    }

    sql += `
      ORDER BY created_at DESC
      LIMIT 500
    `;

    const specialists = db.prepare(sql).all(params);

    res.json({
      ok: true,
      specialists
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "SPECIALISTS_LIST_ERROR",
      message: error.message
    });
  }
});

router.get("/summary", (req, res) => {
  try {
    const total = db.prepare(`
      SELECT COUNT(*) AS total
      FROM specialists
    `).get().total;

    const active = db.prepare(`
      SELECT COUNT(*) AS total
      FROM specialists
      WHERE status = 'active'
    `).get().total;

    const inactive = db.prepare(`
      SELECT COUNT(*) AS total
      FROM specialists
      WHERE status != 'active'
    `).get().total;

    const available = db.prepare(`
      SELECT COUNT(*) AS total
      FROM specialists
      WHERE LOWER(availability) IN (
        'available',
        'available_now',
        'online',
        'disponivel',
        'disponível'
      )
    `).get().total;

    res.json({
      ok: true,
      summary: {
        total,
        active,
        inactive,
        available
      }
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "SPECIALISTS_SUMMARY_ERROR",
      message: error.message
    });
  }
});

router.get("/:id", (req, res) => {
  try {
    const specialist = db.prepare(`
      SELECT
        id,
        name,
        email,
        phone,
        specialty,
        status,
        availability,
        notes,
        created_at,
        updated_at
      FROM specialists
      WHERE id = ?
    `).get(req.params.id);

    if (!specialist) {
      return res.status(404).json({
        ok: false,
        error: "SPECIALIST_NOT_FOUND"
      });
    }

    res.json({
      ok: true,
      specialist
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "SPECIALIST_DETAIL_ERROR",
      message: error.message
    });
  }
});

router.post("/", (req, res) => {
  try {
    const {
      name,
      email = "",
      phone = "",
      specialty = "",
      availability = "unavailable",
      notes = ""
    } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        ok: false,
        error: "NAME_REQUIRED"
      });
    }

    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO specialists (
        id,
        name,
        email,
        phone,
        specialty,
        status,
        availability,
        notes,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      id,
      String(name).trim(),
      String(email),
      String(phone),
      String(specialty),
      String(availability),
      String(notes)
    );

    audit(
      req.admin.id,
      "admin.specialist.created",
      id,
      { name }
    );

    const specialist = db.prepare(`
      SELECT *
      FROM specialists
      WHERE id = ?
    `).get(id);

    res.status(201).json({
      ok: true,
      specialist
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "SPECIALIST_CREATE_ERROR",
      message: error.message
    });
  }
});

router.patch("/:id", (req, res) => {
  try {
    const current = db.prepare(`
      SELECT *
      FROM specialists
      WHERE id = ?
    `).get(req.params.id);

    if (!current) {
      return res.status(404).json({
        ok: false,
        error: "SPECIALIST_NOT_FOUND"
      });
    }

    const fields = {
      name: "name",
      email: "email",
      phone: "phone",
      specialty: "specialty",
      availability: "availability",
      notes: "notes"
    };

    const updates = [];
    const values = [];

    for (const [input, column] of Object.entries(fields)) {
      if (req.body?.[input] !== undefined) {
        updates.push(`${column} = ?`);
        values.push(String(req.body[input]));
      }
    }

    if (!updates.length) {
      return res.json({
        ok: true,
        specialist: current
      });
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(req.params.id);

    db.prepare(`
      UPDATE specialists
      SET ${updates.join(", ")}
      WHERE id = ?
    `).run(...values);

    audit(
      req.admin.id,
      "admin.specialist.updated",
      req.params.id,
      {
        fields: Object.keys(req.body || {})
      }
    );

    const specialist = db.prepare(`
      SELECT *
      FROM specialists
      WHERE id = ?
    `).get(req.params.id);

    res.json({
      ok: true,
      specialist
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "SPECIALIST_UPDATE_ERROR",
      message: error.message
    });
  }
});

router.patch("/:id/status", (req, res) => {
  try {
    const allowed = [
      "active",
      "inactive",
      "blocked"
    ];

    if (!allowed.includes(req.body?.status)) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_STATUS"
      });
    }

    const result = db.prepare(`
      UPDATE specialists
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
        error: "SPECIALIST_NOT_FOUND"
      });
    }

    audit(
      req.admin.id,
      "admin.specialist.status_updated",
      req.params.id,
      {
        status: req.body.status
      }
    );

    res.json({
      ok: true,
      status: req.body.status
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "SPECIALIST_STATUS_ERROR",
      message: error.message
    });
  }
});

export default router;

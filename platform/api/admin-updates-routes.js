import express from "express";
import db from "./database.js";

const router = express.Router();

function audit(adminId, action, entityId, details = {}) {
  db.prepare(`
    INSERT INTO audit_logs
    (user_id, action, entity, entity_id, details)
    VALUES (NULL, ?, ?, ?, ?)
  `).run(
    action,
    "update",
    String(entityId),
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
      type = ""
    } = req.query;

    let sql = `
      SELECT
        id,
        version,
        type,
        description,
        status,
        created_at
      FROM updates
      WHERE 1=1
    `;

    const params = {};

    if (search) {
      sql += `
        AND (
          version LIKE @search
          OR type LIKE @search
          OR description LIKE @search
        )
      `;

      params.search = `%${search}%`;
    }

    if (status) {
      sql += ` AND status = @status`;
      params.status = status;
    }

    if (type) {
      sql += ` AND type = @type`;
      params.type = type;
    }

    sql += `
      ORDER BY created_at DESC
      LIMIT 500
    `;

    const updates = db.prepare(sql).all(params);

    res.json({
      ok: true,
      updates
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "UPDATES_LIST_ERROR",
      message: error.message
    });
  }
});

router.get("/summary", (req, res) => {
  try {
    const total = db.prepare(`
      SELECT COUNT(*) AS total
      FROM updates
    `).get().total;

    const published = db.prepare(`
      SELECT COUNT(*) AS total
      FROM updates
      WHERE status = 'published'
    `).get().total;

    const draft = db.prepare(`
      SELECT COUNT(*) AS total
      FROM updates
      WHERE status = 'draft'
    `).get().total;

    const archived = db.prepare(`
      SELECT COUNT(*) AS total
      FROM updates
      WHERE status = 'archived'
    `).get().total;

    res.json({
      ok: true,
      summary: {
        total,
        published,
        draft,
        archived
      }
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "UPDATES_SUMMARY_ERROR",
      message: error.message
    });
  }
});

router.get("/:id", (req, res) => {
  try {
    const update = db.prepare(`
      SELECT *
      FROM updates
      WHERE id = ?
    `).get(req.params.id);

    if (!update) {
      return res.status(404).json({
        ok: false,
        error: "UPDATE_NOT_FOUND"
      });
    }

    res.json({
      ok: true,
      update
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "UPDATE_DETAIL_ERROR"
    });
  }
});

router.post("/", (req, res) => {
  try {
    const {
      version,
      type = "android",
      description = "",
      status = "draft"
    } = req.body || {};

    if (!version) {
      return res.status(400).json({
        ok: false,
        error: "VERSION_REQUIRED"
      });
    }

    const allowed = [
      "draft",
      "published",
      "archived"
    ];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_STATUS"
      });
    }

    const result = db.prepare(`
      INSERT INTO updates (
        version,
        type,
        description,
        status,
        created_at
      )
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      String(version),
      String(type),
      String(description),
      String(status)
    );

    const id = result.lastInsertRowid;

    audit(
      req.admin.id,
      "admin.update.created",
      id,
      {
        version,
        type,
        status
      }
    );

    const update = db.prepare(`
      SELECT *
      FROM updates
      WHERE id = ?
    `).get(id);

    res.status(201).json({
      ok: true,
      update
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "UPDATE_CREATE_ERROR",
      message: error.message
    });
  }
});

router.patch("/:id", (req, res) => {
  try {
    const current = db.prepare(`
      SELECT *
      FROM updates
      WHERE id = ?
    `).get(req.params.id);

    if (!current) {
      return res.status(404).json({
        ok: false,
        error: "UPDATE_NOT_FOUND"
      });
    }

    const fields = {
      version: "version",
      type: "type",
      description: "description",
      status: "status"
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
        update: current
      });
    }

    values.push(req.params.id);

    db.prepare(`
      UPDATE updates
      SET ${updates.join(", ")}
      WHERE id = ?
    `).run(...values);

    audit(
      req.admin.id,
      "admin.update.updated",
      req.params.id,
      {
        fields: Object.keys(req.body || {})
      }
    );

    const update = db.prepare(`
      SELECT *
      FROM updates
      WHERE id = ?
    `).get(req.params.id);

    res.json({
      ok: true,
      update
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "UPDATE_UPDATE_ERROR",
      message: error.message
    });
  }
});

router.patch("/:id/status", (req, res) => {
  const allowed = [
    "draft",
    "published",
    "archived"
  ];

  if (!allowed.includes(req.body?.status)) {
    return res.status(400).json({
      ok: false,
      error: "INVALID_STATUS"
    });
  }

  const result = db.prepare(`
    UPDATE updates
    SET status = ?
    WHERE id = ?
  `).run(
    req.body.status,
    req.params.id
  );

  if (!result.changes) {
    return res.status(404).json({
      ok: false,
      error: "UPDATE_NOT_FOUND"
    });
  }

  audit(
    req.admin.id,
    "admin.update.status_updated",
    req.params.id,
    {
      status: req.body.status
    }
  );

  res.json({
    ok: true,
    status: req.body.status
  });
});

export default router;

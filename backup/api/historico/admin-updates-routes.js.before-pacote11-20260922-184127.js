import express from "express";
import crypto from "crypto";
import db from "./database.js";

const router = express.Router();

function now() {
  return new Date().toISOString();
}

function audit(adminId, action, entityId, details = {}) {
  db.prepare(`
    INSERT INTO audit_logs
    (user_id, action, entity, entity_id, details)
    VALUES (NULL, ?, ?, ?, ?)
  `).run(
    action,
    "update",
    entityId,
    JSON.stringify({
      adminId,
      ...details
    })
  );
}

function normalize(row) {
  if (!row) return row;

  return {
    ...row,
    mandatory: Boolean(row.mandatory)
  };
}

router.get("/", (req, res) => {
  try {
    const {
      search = "",
      status = "",
      platform = ""
    } = req.query;

    let sql = `
      SELECT *
      FROM updates
      WHERE 1=1
    `;

    const params = {};

    if (search) {
      sql += `
        AND (
          version LIKE @search
          OR title LIKE @search
          OR description LIKE @search
        )
      `;
      params.search = `%${search}%`;
    }

    if (status) {
      sql += ` AND status = @status`;
      params.status = status;
    }

    if (platform) {
      sql += ` AND platform = @platform`;
      params.platform = platform;
    }

    sql += `
      ORDER BY
        COALESCE(published_at, created_at) DESC
      LIMIT 500
    `;

    const updates = db.prepare(sql)
      .all(params)
      .map(normalize);

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

    const mandatory = db.prepare(`
      SELECT COUNT(*) AS total
      FROM updates
      WHERE mandatory = 1
    `).get().total;

    res.json({
      ok: true,
      summary: {
        total,
        published,
        draft,
        mandatory
      }
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "UPDATES_SUMMARY_ERROR"
    });
  }
});

router.get("/:id", (req, res) => {
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
    update: normalize(update)
  });
});

router.post("/", (req, res) => {
  try {
    const {
      version,
      title,
      description = "",
      releaseNotes = "",
      downloadUrl = "",
      platform = "android",
      status = "draft",
      mandatory = false
    } = req.body || {};

    if (!version || !title) {
      return res.status(400).json({
        ok: false,
        error: "VERSION_AND_TITLE_REQUIRED"
      });
    }

    const allowedStatus = [
      "draft",
      "published",
      "archived"
    ];

    if (!allowedStatus.includes(status)) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_STATUS"
      });
    }

    const id = crypto.randomUUID();

    const publishedAt =
      status === "published"
        ? now()
        : null;

    db.prepare(`
      INSERT INTO updates
      (
        id,
        version,
        title,
        description,
        release_notes,
        download_url,
        platform,
        status,
        mandatory,
        published_at,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      String(version),
      String(title),
      String(description),
      String(releaseNotes),
      String(downloadUrl),
      String(platform),
      status,
      mandatory ? 1 : 0,
      publishedAt,
      now(),
      now()
    );

    audit(
      req.admin.id,
      "admin.update.created",
      id,
      { version, status }
    );

    const update = db.prepare(`
      SELECT *
      FROM updates
      WHERE id = ?
    `).get(id);

    res.status(201).json({
      ok: true,
      update: normalize(update)
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

    const map = {
      version: "version",
      title: "title",
      description: "description",
      releaseNotes: "release_notes",
      downloadUrl: "download_url",
      platform: "platform",
      status: "status",
      mandatory: "mandatory"
    };

    const updates = [];
    const values = [];

    for (const [input, column] of Object.entries(map)) {
      if (req.body?.[input] !== undefined) {
        updates.push(`${column} = ?`);

        if (input === "mandatory") {
          values.push(req.body[input] ? 1 : 0);
        } else {
          values.push(String(req.body[input]));
        }
      }
    }

    if (req.body?.status === "published") {
      updates.push("published_at = ?");
      values.push(current.published_at || now());
    }

    if (!updates.length) {
      return res.json({
        ok: true,
        update: normalize(current)
      });
    }

    updates.push("updated_at = ?");
    values.push(now());

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
      update: normalize(update)
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

  const publishedAt =
    req.body.status === "published"
      ? now()
      : null;

  const result = db.prepare(`
    UPDATE updates
    SET
      status = ?,
      published_at = CASE
        WHEN ? = 'published'
        THEN COALESCE(published_at, ?)
        ELSE published_at
      END,
      updated_at = ?
    WHERE id = ?
  `).run(
    req.body.status,
    req.body.status,
    publishedAt,
    now(),
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

import express from "express";
import crypto from "crypto";
import db from "./database.js";

const router = express.Router();

function parsePlan(row) {
  if (!row) return row;

  let features = [];

  if (row.features) {
    try {
      features = JSON.parse(row.features);
    } catch {
      features = [];
    }
  }

  return {
    ...row,
    price: Number(row.price || 0),
    active: Boolean(row.active),
    features
  };
}

function audit(adminId, action, entityId, details = {}) {
  db.prepare(`
    INSERT INTO audit_logs
    (user_id, action, entity, entity_id, details)
    VALUES (NULL, ?, ?, ?, ?)
  `).run(
    action,
    "plan",
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
      active = ""
    } = req.query;

    let sql = `
      SELECT *
      FROM plans
      WHERE 1=1
    `;

    const params = {};

    if (search) {
      sql += `
        AND (
          name LIKE @search
          OR description LIKE @search
        )
      `;

      params.search = `%${search}%`;
    }

    if (active !== "") {
      sql += ` AND active = @active`;
      params.active = Number(active) ? 1 : 0;
    }

    sql += `
      ORDER BY price ASC, created_at ASC
      LIMIT 500
    `;

    const plans = db.prepare(sql)
      .all(params)
      .map(parsePlan);

    res.json({
      ok: true,
      plans
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "PLANS_LIST_ERROR",
      message: error.message
    });
  }
});

router.get("/summary", (req, res) => {
  try {
    const total = db.prepare(`
      SELECT COUNT(*) AS total
      FROM plans
    `).get().total;

    const active = db.prepare(`
      SELECT COUNT(*) AS total
      FROM plans
      WHERE active = 1
    `).get().total;

    const inactive = db.prepare(`
      SELECT COUNT(*) AS total
      FROM plans
      WHERE active = 0
    `).get().total;

    const paid = db.prepare(`
      SELECT COUNT(*) AS total
      FROM plans
      WHERE price > 0
    `).get().total;

    res.json({
      ok: true,
      summary: {
        total,
        active,
        inactive,
        paid
      }
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "PLANS_SUMMARY_ERROR",
      message: error.message
    });
  }
});

router.get("/:id", (req, res) => {
  const plan = db.prepare(`
    SELECT *
    FROM plans
    WHERE id = ?
  `).get(req.params.id);

  if (!plan) {
    return res.status(404).json({
      ok: false,
      error: "PLAN_NOT_FOUND"
    });
  }

  res.json({
    ok: true,
    plan: parsePlan(plan)
  });
});

router.post("/", (req, res) => {
  try {
    const {
      name,
      description = "",
      price = 0,
      active = 1,
      features = []
    } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        ok: false,
        error: "NAME_REQUIRED"
      });
    }

    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO plans (
        id,
        name,
        description,
        price,
        active,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      id,
      String(name).trim(),
      String(description),
      Number(price) || 0,
      active ? 1 : 0
    );

    audit(
      req.admin.id,
      "admin.plan.created",
      id,
      {
        name,
        features
      }
    );

    const plan = db.prepare(`
      SELECT *
      FROM plans
      WHERE id = ?
    `).get(id);

    res.status(201).json({
      ok: true,
      plan: parsePlan(plan)
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "PLAN_CREATE_ERROR",
      message: error.message
    });
  }
});

router.patch("/:id", (req, res) => {
  try {
    const current = db.prepare(`
      SELECT *
      FROM plans
      WHERE id = ?
    `).get(req.params.id);

    if (!current) {
      return res.status(404).json({
        ok: false,
        error: "PLAN_NOT_FOUND"
      });
    }

    const fields = {
      name: "name",
      description: "description",
      price: "price",
      active: "active"
    };

    const updates = [];
    const values = [];

    for (const [input, column] of Object.entries(fields)) {
      if (req.body?.[input] !== undefined) {
        updates.push(`${column} = ?`);

        if (input === "price") {
          values.push(Number(req.body[input]) || 0);
        } else if (input === "active") {
          values.push(req.body[input] ? 1 : 0);
        } else {
          values.push(String(req.body[input]));
        }
      }
    }

    if (!updates.length) {
      return res.json({
        ok: true,
        plan: parsePlan(current)
      });
    }

    values.push(req.params.id);

    db.prepare(`
      UPDATE plans
      SET ${updates.join(", ")}
      WHERE id = ?
    `).run(...values);

    audit(
      req.admin.id,
      "admin.plan.updated",
      req.params.id,
      {
        fields: Object.keys(req.body || {})
      }
    );

    const plan = db.prepare(`
      SELECT *
      FROM plans
      WHERE id = ?
    `).get(req.params.id);

    res.json({
      ok: true,
      plan: parsePlan(plan)
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "PLAN_UPDATE_ERROR",
      message: error.message
    });
  }
});

router.patch("/:id/status", (req, res) => {
  if (
    req.body?.status !== "active" &&
    req.body?.status !== "inactive"
  ) {
    return res.status(400).json({
      ok: false,
      error: "INVALID_STATUS"
    });
  }

  const active =
    req.body.status === "active" ? 1 : 0;

  const result = db.prepare(`
    UPDATE plans
    SET active = ?
    WHERE id = ?
  `).run(
    active,
    req.params.id
  );

  if (!result.changes) {
    return res.status(404).json({
      ok: false,
      error: "PLAN_NOT_FOUND"
    });
  }

  audit(
    req.admin.id,
    "admin.plan.status_updated",
    req.params.id,
    {
      active
    }
  );

  res.json({
    ok: true,
    active: Boolean(active)
  });
});

export default router;

import express from "express";
import crypto from "crypto";
import db from "./database.js";

const router = express.Router();

function now() {
  return new Date().toISOString();
}

function parsePlan(row) {
  if (!row) return row;

  let features = [];

  try {
    features = JSON.parse(row.features || "[]");
  } catch {
    features = [];
  }

  return {
    ...row,
    price: Number(row.price || 0),
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
      status = ""
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

    if (status) {
      sql += ` AND status = @status`;
      params.status = status;
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
      WHERE status = 'active'
    `).get().total;

    const inactive = db.prepare(`
      SELECT COUNT(*) AS total
      FROM plans
      WHERE status != 'active'
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
      error: "PLANS_SUMMARY_ERROR"
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
      currency = "BRL",
      billingPeriod = "monthly",
      status = "active",
      features = []
    } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        ok: false,
        error: "NAME_REQUIRED"
      });
    }

    const id = crypto.randomUUID();

    const featureList =
      Array.isArray(features)
        ? features
        : [];

    db.prepare(`
      INSERT INTO plans
      (
        id,
        name,
        description,
        price,
        currency,
        billing_period,
        status,
        features,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      String(name).trim(),
      String(description),
      Number(price) || 0,
      String(currency),
      String(billingPeriod),
      String(status),
      JSON.stringify(featureList),
      now(),
      now()
    );

    audit(
      req.admin.id,
      "admin.plan.created",
      id,
      { name }
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

    const updates = [];
    const values = [];

    const fields = {
      name: "name",
      description: "description",
      price: "price",
      currency: "currency",
      billingPeriod: "billing_period",
      status: "status"
    };

    for (const [input, column] of Object.entries(fields)) {
      if (req.body?.[input] !== undefined) {
        updates.push(`${column} = ?`);

        if (input === "price") {
          values.push(Number(req.body[input]) || 0);
        } else {
          values.push(String(req.body[input]));
        }
      }
    }

    if (req.body?.features !== undefined) {
      updates.push("features = ?");
      values.push(
        JSON.stringify(
          Array.isArray(req.body.features)
            ? req.body.features
            : []
        )
      );
    }

    if (!updates.length) {
      return res.json({
        ok: true,
        plan: parsePlan(current)
      });
    }

    updates.push("updated_at = ?");
    values.push(now());

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
  const allowed = [
    "active",
    "inactive",
    "archived"
  ];

  if (!allowed.includes(req.body?.status)) {
    return res.status(400).json({
      ok: false,
      error: "INVALID_STATUS"
    });
  }

  const result = db.prepare(`
    UPDATE plans
    SET status = ?, updated_at = ?
    WHERE id = ?
  `).run(
    req.body.status,
    now(),
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
      status: req.body.status
    }
  );

  res.json({
    ok: true,
    status: req.body.status
  });
});

export default router;

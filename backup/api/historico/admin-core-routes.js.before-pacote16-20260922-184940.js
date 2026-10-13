import crypto from "node:crypto";
import { db } from "./database.js";

function makeId() {
  return crypto.randomUUID();
}

function adminAudit(req, action, entity, entityId, details = {}) {
  try {
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
      JSON.stringify(details),
      Date.now().toString()
    );
  } catch (error) {
    console.error("ADMIN AUDIT ERROR:", error);
  }
}

export function registerAdminCoreRoutes(app, requireAdmin) {

  // ==========================================================
  // PERMISSÕES
  // ==========================================================

  app.get(
    "/api/admin/permissions",
    requireAdmin,
    (req, res) => {
      try {
        const permissions = db.prepare(`
          SELECT
            id,
            code,
            name,
            description,
            created_at
          FROM admin_permissions
          ORDER BY code
        `).all();

        res.json({
          ok: true,
          permissions
        });
      } catch (error) {
        console.error("ADMIN PERMISSIONS ERROR:", error);
        res.status(500).json({
          ok: false,
          error: "ADMIN_PERMISSIONS_ERROR"
        });
      }
    }
  );

  // ==========================================================
  // ESPECIALISTAS
  // ==========================================================

  app.get(
    "/api/admin/specialists",
    requireAdmin,
    (req, res) => {
      try {
        const specialists = db.prepare(`
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
          ORDER BY created_at DESC
        `).all();

        res.json({
          ok: true,
          specialists
        });
      } catch (error) {
        console.error("ADMIN SPECIALISTS ERROR:", error);
        res.status(500).json({
          ok: false,
          error: "ADMIN_SPECIALISTS_ERROR"
        });
      }
    }
  );

  app.post(
    "/api/admin/specialists",
    requireAdmin,
    (req, res) => {
      try {
        const {
          name,
          email = null,
          phone = null,
          specialty = null,
          status = "active",
          availability = "offline",
          notes = null
        } = req.body || {};

        if (!name || !String(name).trim()) {
          return res.status(400).json({
            ok: false,
            error: "NAME_REQUIRED"
          });
        }

        const specialistId = makeId();

        db.prepare(`
          INSERT INTO specialists (
            id,
            name,
            email,
            phone,
            specialty,
            status,
            availability,
            notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          specialistId,
          String(name).trim(),
          email,
          phone,
          specialty,
          status,
          availability,
          notes
        );

        adminAudit(
          req,
          "admin.specialist.create",
          "specialist",
          specialistId,
          { name: String(name).trim() }
        );

        const specialist = db.prepare(`
          SELECT *
          FROM specialists
          WHERE id = ?
        `).get(specialistId);

        res.status(201).json({
          ok: true,
          specialist
        });
      } catch (error) {
        console.error("ADMIN SPECIALIST CREATE ERROR:", error);
        res.status(500).json({
          ok: false,
          error: "ADMIN_SPECIALIST_CREATE_ERROR"
        });
      }
    }
  );

  app.patch(
    "/api/admin/specialists/:id",
    requireAdmin,
    (req, res) => {
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

        const allowed = [
          "name",
          "email",
          "phone",
          "specialty",
          "status",
          "availability",
          "notes"
        ];

        const values = {};
        for (const key of allowed) {
          if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
            values[key] = req.body[key];
          }
        }

        if (!Object.keys(values).length) {
          return res.status(400).json({
            ok: false,
            error: "NO_FIELDS_TO_UPDATE"
          });
        }

        const sets = [];
        const params = [];

        for (const [key, value] of Object.entries(values)) {
          sets.push(`${key} = ?`);
          params.push(value);
        }

        sets.push("updated_at = CURRENT_TIMESTAMP");
        params.push(req.params.id);

        db.prepare(`
          UPDATE specialists
          SET ${sets.join(", ")}
          WHERE id = ?
        `).run(...params);

        adminAudit(
          req,
          "admin.specialist.update",
          "specialist",
          req.params.id,
          values
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
        console.error("ADMIN SPECIALIST UPDATE ERROR:", error);
        res.status(500).json({
          ok: false,
          error: "ADMIN_SPECIALIST_UPDATE_ERROR"
        });
      }
    }
  );

  // ==========================================================
  // SEGURANÇA
  // ==========================================================

  app.get(
    "/api/admin/security/events",
    requireAdmin,
    (req, res) => {
      try {
        const limit = Math.min(
          Math.max(Number(req.query.limit) || 100, 1),
          500
        );

        const events = db.prepare(`
          SELECT
            se.id,
            se.user_id,
            se.device_id,
            se.type,
            se.severity,
            se.title,
            se.description,
            se.metadata,
            se.resolved,
            se.created_at,
            se.resolved_at,
            u.name AS user_name,
            u.email AS user_email
          FROM security_events se
          LEFT JOIN users u ON u.id = se.user_id
          ORDER BY se.id DESC
          LIMIT ?
        `).all(limit);

        res.json({
          ok: true,
          events
        });
      } catch (error) {
        console.error("ADMIN SECURITY EVENTS ERROR:", error);
        res.status(500).json({
          ok: false,
          error: "ADMIN_SECURITY_EVENTS_ERROR"
        });
      }
    }
  );

  app.patch(
    "/api/admin/security/events/:id",
    requireAdmin,
    (req, res) => {
      try {
        const resolved = req.body?.resolved;

        if (typeof resolved !== "boolean") {
          return res.status(400).json({
            ok: false,
            error: "RESOLVED_BOOLEAN_REQUIRED"
          });
        }

        const result = db.prepare(`
          UPDATE security_events
          SET
            resolved = ?,
            resolved_at = ?
          WHERE id = ?
        `).run(
          resolved ? 1 : 0,
          resolved ? new Date().toISOString() : null,
          req.params.id
        );

        if (!result.changes) {
          return res.status(404).json({
            ok: false,
            error: "SECURITY_EVENT_NOT_FOUND"
          });
        }

        adminAudit(
          req,
          "admin.security.event.update",
          "security_event",
          req.params.id,
          { resolved }
        );

        res.json({
          ok: true
        });
      } catch (error) {
        console.error("ADMIN SECURITY EVENT UPDATE ERROR:", error);
        res.status(500).json({
          ok: false,
          error: "ADMIN_SECURITY_EVENT_UPDATE_ERROR"
        });
      }
    }
  );

  // ==========================================================
  // CONFIGURAÇÕES
  // ==========================================================

  app.get(
    "/api/admin/settings",
    requireAdmin,
    (req, res) => {
      try {
        const settings = db.prepare(`
          SELECT
            key,
            value,
            type,
            description,
            updated_at
          FROM admin_settings
          ORDER BY key
        `).all();

        res.json({
          ok: true,
          settings
        });
      } catch (error) {
        console.error("ADMIN SETTINGS ERROR:", error);
        res.status(500).json({
          ok: false,
          error: "ADMIN_SETTINGS_ERROR"
        });
      }
    }
  );

  app.put(
    "/api/admin/settings/:key",
    requireAdmin,
    (req, res) => {
      try {
        const key = req.params.key;
        const value = req.body?.value;

        if (value === undefined) {
          return res.status(400).json({
            ok: false,
            error: "VALUE_REQUIRED"
          });
        }

        const existing = db.prepare(`
          SELECT key
          FROM admin_settings
          WHERE key = ?
        `).get(key);

        if (!existing) {
          return res.status(404).json({
            ok: false,
            error: "SETTING_NOT_FOUND"
          });
        }

        db.prepare(`
          UPDATE admin_settings
          SET
            value = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE key = ?
        `).run(
          typeof value === "string"
            ? value
            : JSON.stringify(value),
          key
        );

        adminAudit(
          req,
          "admin.setting.update",
          "setting",
          key,
          { value }
        );

        const setting = db.prepare(`
          SELECT *
          FROM admin_settings
          WHERE key = ?
        `).get(key);

        res.json({
          ok: true,
          setting
        });
      } catch (error) {
        console.error("ADMIN SETTING UPDATE ERROR:", error);
        res.status(500).json({
          ok: false,
          error: "ADMIN_SETTING_UPDATE_ERROR"
        });
      }
    }
  );

  // ==========================================================
  // PROTEÇÃO — CATEGORIAS
  // ==========================================================

  app.get(
    "/api/admin/protection/categories",
    requireAdmin,
    (req, res) => {
      try {
        const categories = db.prepare(`
          SELECT *
          FROM protection_categories
          ORDER BY name
        `).all();

        res.json({
          ok: true,
          categories
        });
      } catch (error) {
        console.error("ADMIN PROTECTION CATEGORIES ERROR:", error);
        res.status(500).json({
          ok: false,
          error: "ADMIN_PROTECTION_CATEGORIES_ERROR"
        });
      }
    }
  );

  // ==========================================================
  // PROTEÇÃO — REGRAS
  // ==========================================================

  app.get(
    "/api/admin/protection/rules",
    requireAdmin,
    (req, res) => {
      try {
        const rules = db.prepare(`
          SELECT
            pr.*,
            pc.name AS category_name
          FROM protection_rules pr
          LEFT JOIN protection_categories pc
            ON pc.id = pr.category_id
          ORDER BY pr.created_at DESC
        `).all();

        res.json({
          ok: true,
          rules
        });
      } catch (error) {
        console.error("ADMIN PROTECTION RULES ERROR:", error);
        res.status(500).json({
          ok: false,
          error: "ADMIN_PROTECTION_RULES_ERROR"
        });
      }
    }
  );

  // ==========================================================
  // PROTEÇÃO — RELATÓRIOS
  // ==========================================================

  app.get(
    "/api/admin/protection/reports",
    requireAdmin,
    (req, res) => {
      try {
        const reports = db.prepare(`
          SELECT
            pr.*,
            u.name AS user_name,
            u.email AS user_email
          FROM protection_reports pr
          LEFT JOIN users u ON u.id = pr.user_id
          ORDER BY pr.created_at DESC
          LIMIT 500
        `).all();

        res.json({
          ok: true,
          reports
        });
      } catch (error) {
        console.error("ADMIN PROTECTION REPORTS ERROR:", error);
        res.status(500).json({
          ok: false,
          error: "ADMIN_PROTECTION_REPORTS_ERROR"
        });
      }
    }
  );

  // ==========================================================
  // PEDIDOS DE REMOÇÃO
  // ==========================================================

  app.get(
    "/api/admin/removal-requests",
    requireAdmin,
    (req, res) => {
      try {
        const requests = db.prepare(`
          SELECT
            rr.*,
            u.name AS user_name,
            u.email AS user_email
          FROM removal_requests rr
          LEFT JOIN users u ON u.id = rr.user_id
          ORDER BY rr.created_at DESC
          LIMIT 500
        `).all();

        res.json({
          ok: true,
          requests
        });
      } catch (error) {
        console.error("ADMIN REMOVAL REQUESTS ERROR:", error);
        res.status(500).json({
          ok: false,
          error: "ADMIN_REMOVAL_REQUESTS_ERROR"
        });
      }
    }
  );

  // ==========================================================
  // NOTAS ADMINISTRATIVAS
  // ==========================================================

  app.get(
    "/api/admin/notes/:entityType/:entityId",
    requireAdmin,
    (req, res) => {
      try {
        const notes = db.prepare(`
          SELECT
            id,
            admin_id,
            entity_type,
            entity_id,
            note,
            created_at
          FROM admin_notes
          WHERE entity_type = ?
            AND entity_id = ?
          ORDER BY id DESC
        `).all(
          req.params.entityType,
          req.params.entityId
        );

        res.json({
          ok: true,
          notes
        });
      } catch (error) {
        console.error("ADMIN NOTES ERROR:", error);
        res.status(500).json({
          ok: false,
          error: "ADMIN_NOTES_ERROR"
        });
      }
    }
  );

  app.post(
    "/api/admin/notes/:entityType/:entityId",
    requireAdmin,
    (req, res) => {
      try {
        const note = String(req.body?.note || "").trim();

        if (!note) {
          return res.status(400).json({
            ok: false,
            error: "NOTE_REQUIRED"
          });
        }

        const result = db.prepare(`
          INSERT INTO admin_notes (
            admin_id,
            entity_type,
            entity_id,
            note
          )
          VALUES (?, ?, ?, ?)
        `).run(
          req.admin.id,
          req.params.entityType,
          req.params.entityId,
          note
        );

        adminAudit(
          req,
          "admin.note.create",
          req.params.entityType,
          req.params.entityId
        );

        const created = db.prepare(`
          SELECT *
          FROM admin_notes
          WHERE id = ?
        `).get(result.lastInsertRowid);

        res.status(201).json({
          ok: true,
          note: created
        });
      } catch (error) {
        console.error("ADMIN NOTE CREATE ERROR:", error);
        res.status(500).json({
          ok: false,
          error: "ADMIN_NOTE_CREATE_ERROR"
        });
      }
    }
  );

  // ==========================================================
  // RESUMO DO MÓDULO ADMIN
  // ==========================================================

  app.get(
    "/api/admin/core-summary",
    requireAdmin,
    (req, res) => {
      try {
        const summary = {
          specialists: db.prepare(`
            SELECT COUNT(*) AS total
            FROM specialists
          `).get().total,

          activeSpecialists: db.prepare(`
            SELECT COUNT(*) AS total
            FROM specialists
            WHERE status = 'active'
          `).get().total,

          securityEvents: db.prepare(`
            SELECT COUNT(*) AS total
            FROM security_events
          `).get().total,

          unresolvedSecurityEvents: db.prepare(`
            SELECT COUNT(*) AS total
            FROM security_events
            WHERE resolved = 0
          `).get().total,

          protectionReports: db.prepare(`
            SELECT COUNT(*) AS total
            FROM protection_reports
          `).get().total,

          removalRequests: db.prepare(`
            SELECT COUNT(*) AS total
            FROM removal_requests
          `).get().total,

          pendingRemovalRequests: db.prepare(`
            SELECT COUNT(*) AS total
            FROM removal_requests
            WHERE status = 'pending'
          `).get().total
        };

        res.json({
          ok: true,
          summary
        });
      } catch (error) {
        console.error("ADMIN CORE SUMMARY ERROR:", error);
        res.status(500).json({
          ok: false,
          error: "ADMIN_CORE_SUMMARY_ERROR"
        });
      }
    }
  );
}

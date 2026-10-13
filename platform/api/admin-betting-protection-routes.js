import crypto from "node:crypto";
import { db } from "./database.js";

function id() {
  return crypto.randomUUID();
}

function audit(req, action, entity, entityId = null, details = {}) {
  try {
    db.prepare(`
      INSERT INTO audit_logs
      (action, entity, entity_id, details, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      action,
      entity,
      entityId,
      JSON.stringify({
        ...details,
        adminId: req.admin?.id ?? null
      })
    );
  } catch (error) {
    console.error("BETTING AUDIT ERROR:", error.message);
  }
}

export function registerAdminBettingProtectionRoutes(app, requireAdmin) {

  /*
   * ==========================================
   * VISÃO GERAL
   * ==========================================
   */

  app.get("/api/admin/betting-protection/summary", requireAdmin, (req, res) => {
    try {
      const summary = {
        profiles: db.prepare(`
          SELECT COUNT(*) AS total
          FROM betting_protection_profiles
        `).get().total,

        activeProfiles: db.prepare(`
          SELECT COUNT(*) AS total
          FROM betting_protection_profiles
          WHERE enabled = 1
        `).get().total,

        maximumProtection: db.prepare(`
          SELECT COUNT(*) AS total
          FROM betting_protection_profiles
          WHERE protection_level = 'maximum'
        `).get().total,

        blockedDomains: db.prepare(`
          SELECT COUNT(*) AS total
          FROM betting_blocked_domains
          WHERE enabled = 1
        `).get().total,

        blockedApps: db.prepare(`
          SELECT COUNT(*) AS total
          FROM betting_blocked_apps
          WHERE enabled = 1
        `).get().total,

        blockedLinks: db.prepare(`
          SELECT COUNT(*) AS total
          FROM betting_blocked_links
          WHERE enabled = 1
        `).get().total,

        attempts: db.prepare(`
          SELECT COUNT(*) AS total
          FROM betting_access_attempts
        `).get().total,

        blockedAttempts: db.prepare(`
          SELECT COUNT(*) AS total
          FROM betting_access_attempts
          WHERE blocked = 1
        `).get().total,

        relapses: db.prepare(`
          SELECT COUNT(*) AS total
          FROM betting_relapses
        `).get().total,

        radarPending: db.prepare(`
          SELECT COUNT(*) AS total
          FROM betting_radar_items
          WHERE status = 'pending'
        `).get().total,

        protectedDevices: db.prepare(`
          SELECT COUNT(*) AS total
          FROM betting_protected_devices
          WHERE enabled = 1
        `).get().total,

        protectedMoney: db.prepare(`
          SELECT COALESCE(SUM(valor), 0) AS total
          FROM valor_conta_protegido
        `).get().total,

        dailyMissionsCompleted: db.prepare(`
          SELECT COUNT(*) AS total
          FROM missoes_diarias
          WHERE concluida = 1
        `).get().total
      };

      res.json({ ok: true, summary });

    } catch (error) {
      console.error("BETTING SUMMARY ERROR:", error);
      res.status(500).json({
        ok: false,
        error: "BETTING_PROTECTION_SUMMARY_ERROR"
      });
    }
  });


  /*
   * ==========================================
   * NÍVEIS DE PROTEÇÃO
   * ==========================================
   */

  app.get("/api/admin/betting-protection/levels", requireAdmin, (req, res) => {
    try {
      const levels = db.prepare(`
        SELECT *
        FROM betting_protection_levels
        ORDER BY escalation_level ASC
      `).all();

      res.json({ ok: true, levels });
    } catch (error) {
      console.error("BETTING LEVELS ERROR:", error);
      res.status(500).json({
        ok: false,
        error: "BETTING_LEVELS_ERROR"
      });
    }
  });


  app.post("/api/admin/betting-protection/levels", requireAdmin, (req, res) => {
    try {
      const {
        code,
        name,
        description = "",
        escalationLevel = 1
      } = req.body ?? {};

      if (!code || !name) {
        return res.status(400).json({
          ok: false,
          error: "CODE_AND_NAME_REQUIRED"
        });
      }

      const result = db.prepare(`
        INSERT INTO betting_protection_levels
        (code, name, description, escalation_level)
        VALUES (?, ?, ?, ?)
      `).run(
        String(code).trim(),
        String(name).trim(),
        String(description).trim(),
        Number(escalationLevel)
      );

      audit(
        req,
        "admin.betting.level_created",
        "betting_protection_level",
        result.lastInsertRowid,
        { code, name }
      );

      res.status(201).json({
        ok: true,
        id: result.lastInsertRowid
      });

    } catch (error) {
      console.error("BETTING LEVEL CREATE ERROR:", error);

      res.status(500).json({
        ok: false,
        error: "BETTING_LEVEL_CREATE_ERROR"
      });
    }
  });


  /*
   * ==========================================
   * DOMÍNIOS BLOQUEADOS
   * ==========================================
   */

  app.get("/api/admin/betting-protection/domains", requireAdmin, (req, res) => {
    try {
      const domains = db.prepare(`
        SELECT *
        FROM betting_blocked_domains
        ORDER BY id DESC
      `).all();

      res.json({ ok: true, domains });

    } catch (error) {
      console.error("BETTING DOMAINS ERROR:", error);

      res.status(500).json({
        ok: false,
        error: "BETTING_DOMAINS_ERROR"
      });
    }
  });


  app.post("/api/admin/betting-protection/domains", requireAdmin, (req, res) => {
    try {
      const {
        domain,
        category = "betting",
        source = "manual",
        confidence = 1,
        reason = ""
      } = req.body ?? {};

      if (!domain) {
        return res.status(400).json({
          ok: false,
          error: "DOMAIN_REQUIRED"
        });
      }

      const normalized = String(domain)
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .split("/")[0];

      if (!normalized) {
        return res.status(400).json({
          ok: false,
          error: "INVALID_DOMAIN"
        });
      }

      const result = db.prepare(`
        INSERT INTO betting_blocked_domains
        (domain, category, source, confidence, reason)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        normalized,
        category,
        source,
        Number(confidence),
        reason
      );

      audit(
        req,
        "admin.betting.domain_created",
        "betting_blocked_domain",
        result.lastInsertRowid,
        { domain: normalized }
      );

      res.status(201).json({
        ok: true,
        id: result.lastInsertRowid,
        domain: normalized
      });

    } catch (error) {
      console.error("BETTING DOMAIN CREATE ERROR:", error);

      res.status(500).json({
        ok: false,
        error: "BETTING_DOMAIN_CREATE_ERROR"
      });
    }
  });


  app.patch("/api/admin/betting-protection/domains/:id", requireAdmin, (req, res) => {
    try {
      const { enabled, reason } = req.body ?? {};

      const result = db.prepare(`
        UPDATE betting_blocked_domains
        SET
          enabled = COALESCE(?, enabled),
          reason = COALESCE(?, reason),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        enabled === undefined ? null : (enabled ? 1 : 0),
        reason ?? null,
        req.params.id
      );

      if (!result.changes) {
        return res.status(404).json({
          ok: false,
          error: "DOMAIN_NOT_FOUND"
        });
      }

      audit(
        req,
        "admin.betting.domain_updated",
        "betting_blocked_domain",
        req.params.id,
        { enabled, reason }
      );

      res.json({ ok: true });

    } catch (error) {
      console.error("BETTING DOMAIN UPDATE ERROR:", error);

      res.status(500).json({
        ok: false,
        error: "BETTING_DOMAIN_UPDATE_ERROR"
      });
    }
  });


  /*
   * ==========================================
   * APLICATIVOS
   * ==========================================
   */

  app.get("/api/admin/betting-protection/apps", requireAdmin, (req, res) => {
    try {
      const apps = db.prepare(`
        SELECT *
        FROM betting_blocked_apps
        ORDER BY id DESC
      `).all();

      res.json({ ok: true, apps });

    } catch (error) {
      console.error("BETTING APPS ERROR:", error);

      res.status(500).json({
        ok: false,
        error: "BETTING_APPS_ERROR"
      });
    }
  });


  app.post("/api/admin/betting-protection/apps", requireAdmin, (req, res) => {
    try {
      const {
        packageName,
        appName = "",
        source = "manual",
        reason = ""
      } = req.body ?? {};

      if (!packageName) {
        return res.status(400).json({
          ok: false,
          error: "PACKAGE_NAME_REQUIRED"
        });
      }

      const result = db.prepare(`
        INSERT INTO betting_blocked_apps
        (package_name, app_name, source, reason)
        VALUES (?, ?, ?, ?)
      `).run(
        packageName.trim(),
        appName.trim(),
        source,
        reason
      );

      audit(
        req,
        "admin.betting.app_created",
        "betting_blocked_app",
        result.lastInsertRowid,
        { packageName }
      );

      res.status(201).json({
        ok: true,
        id: result.lastInsertRowid
      });

    } catch (error) {
      console.error("BETTING APP CREATE ERROR:", error);

      res.status(500).json({
        ok: false,
        error: "BETTING_APP_CREATE_ERROR"
      });
    }
  });


  /*
   * ==========================================
   * LINKS
   * ==========================================
   */

  app.get("/api/admin/betting-protection/links", requireAdmin, (req, res) => {
    try {
      const links = db.prepare(`
        SELECT *
        FROM betting_blocked_links
        ORDER BY id DESC
      `).all();

      res.json({ ok: true, links });

    } catch (error) {
      console.error("BETTING LINKS ERROR:", error);

      res.status(500).json({
        ok: false,
        error: "BETTING_LINKS_ERROR"
      });
    }
  });


  app.post("/api/admin/betting-protection/links", requireAdmin, (req, res) => {
    try {
      const {
        pattern,
        patternType = "keyword",
        source = "manual",
        reason = ""
      } = req.body ?? {};

      if (!pattern) {
        return res.status(400).json({
          ok: false,
          error: "PATTERN_REQUIRED"
        });
      }

      const result = db.prepare(`
        INSERT INTO betting_blocked_links
        (pattern, pattern_type, source, reason)
        VALUES (?, ?, ?, ?)
      `).run(
        pattern.trim(),
        patternType,
        source,
        reason
      );

      audit(
        req,
        "admin.betting.link_created",
        "betting_blocked_link",
        result.lastInsertRowid,
        { pattern }
      );

      res.status(201).json({
        ok: true,
        id: result.lastInsertRowid
      });

    } catch (error) {
      console.error("BETTING LINK CREATE ERROR:", error);

      res.status(500).json({
        ok: false,
        error: "BETTING_LINK_CREATE_ERROR"
      });
    }
  });


  /*
   * ==========================================
   * TENTATIVAS
   * ==========================================
   */

  app.get("/api/admin/betting-protection/attempts", requireAdmin, (req, res) => {
    try {
      const limit = Math.min(
        Math.max(Number(req.query.limit) || 100, 1),
        500
      );

      const attempts = db.prepare(`
        SELECT
          a.*,
          u.email AS user_email
        FROM betting_access_attempts a
        LEFT JOIN users u ON u.id = a.user_id
        ORDER BY a.id DESC
        LIMIT ?
      `).all(limit);

      res.json({ ok: true, attempts });

    } catch (error) {
      console.error("BETTING ATTEMPTS ERROR:", error);

      res.status(500).json({
        ok: false,
        error: "BETTING_ATTEMPTS_ERROR"
      });
    }
  });


  /*
   * ==========================================
   * REINCIDÊNCIAS
   * ==========================================
   */

  app.get("/api/admin/betting-protection/relapses", requireAdmin, (req, res) => {
    try {
      const relapses = db.prepare(`
        SELECT
          r.*,
          u.email AS user_email
        FROM betting_relapses r
        LEFT JOIN users u ON u.id = r.user_id
        ORDER BY r.id DESC
        LIMIT 500
      `).all();

      res.json({ ok: true, relapses });

    } catch (error) {
      console.error("BETTING RELAPSES ERROR:", error);

      res.status(500).json({
        ok: false,
        error: "BETTING_RELAPSES_ERROR"
      });
    }
  });


  /*
   * ==========================================
   * RADAR
   * ==========================================
   */

  app.get("/api/admin/betting-protection/radar", requireAdmin, (req, res) => {
    try {
      const radar = db.prepare(`
        SELECT *
        FROM betting_radar_items
        ORDER BY id DESC
        LIMIT 500
      `).all();

      res.json({ ok: true, radar });

    } catch (error) {
      console.error("BETTING RADAR ERROR:", error);

      res.status(500).json({
        ok: false,
        error: "BETTING_RADAR_ERROR"
      });
    }
  });


  app.patch("/api/admin/betting-protection/radar/:id", requireAdmin, (req, res) => {
    try {
      const {
        status,
        classification,
        validated,
        addedToBlocklist,
        reason
      } = req.body ?? {};

      const result = db.prepare(`
        UPDATE betting_radar_items
        SET
          status = COALESCE(?, status),
          classification = COALESCE(?, classification),
          validated = COALESCE(?, validated),
          added_to_blocklist = COALESCE(?, added_to_blocklist),
          reason = COALESCE(?, reason),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        status ?? null,
        classification ?? null,
        validated === undefined ? null : (validated ? 1 : 0),
        addedToBlocklist === undefined ? null : (addedToBlocklist ? 1 : 0),
        reason ?? null,
        req.params.id
      );

      if (!result.changes) {
        return res.status(404).json({
          ok: false,
          error: "RADAR_ITEM_NOT_FOUND"
        });
      }

      audit(
        req,
        "admin.betting.radar_updated",
        "betting_radar_item",
        req.params.id,
        {
          status,
          classification,
          validated,
          addedToBlocklist
        }
      );

      res.json({ ok: true });

    } catch (error) {
      console.error("BETTING RADAR UPDATE ERROR:", error);

      res.status(500).json({
        ok: false,
        error: "BETTING_RADAR_UPDATE_ERROR"
      });
    }
  });


  /*
   * ==========================================
   * DISPOSITIVOS PROTEGIDOS
   * ==========================================
   */

  app.get("/api/admin/betting-protection/devices", requireAdmin, (req, res) => {
    try {
      const devices = db.prepare(`
        SELECT
          p.*,
          d.id AS device_id,
          d.user_id,
          d.name AS device_name,
          d.status AS device_status
        FROM betting_protected_devices p
        LEFT JOIN devices d ON d.id = p.device_id
        ORDER BY p.id DESC
      `).all();

      res.json({ ok: true, devices });

    } catch (error) {
      console.error("BETTING DEVICES ERROR:", error);

      res.status(500).json({
        ok: false,
        error: "BETTING_DEVICES_ERROR"
      });
    }
  });


  /*
   * ==========================================
   * DINHEIRO PROTEGIDO
   * ==========================================
   */

  app.get("/api/admin/betting-protection/financial", requireAdmin, (req, res) => {
    try {
      const protectedMoney = db.prepare(`
        SELECT
          COALESCE(SUM(valor), 0) AS total
        FROM valor_conta_protegido
      `).get();

      const records = db.prepare(`
        SELECT
          COUNT(*) AS total_records,
          COALESCE(SUM(valor_deposito), 0) AS deposits_recorded,
          COALESCE(SUM(valor_ganho_imaginado), 0) AS imagined_gains,
          COALESCE(SUM(valor_saque_imaginado), 0) AS imagined_withdrawals,
          COALESCE(SUM(valor_ganho_informado), 0) AS reported_gains,
          COALESCE(SUM(valor_perdido_informado), 0) AS reported_losses
        FROM aposta_registros
      `).get();

      res.json({
        ok: true,
        protectedMoney: protectedMoney.total,
        records
      });

    } catch (error) {
      console.error("BETTING FINANCIAL ERROR:", error);

      res.status(500).json({
        ok: false,
        error: "BETTING_FINANCIAL_ERROR"
      });
    }
  });


  /*
   * ==========================================
   * MISSÕES
   * ==========================================
   */

  app.get("/api/admin/betting-protection/missions", requireAdmin, (req, res) => {
    try {
      const missions = db.prepare(`
        SELECT
          m.*,
          u.email AS user_email
        FROM missoes_diarias m
        LEFT JOIN users u ON u.id = m.usuario_id
        ORDER BY m.id DESC
        LIMIT 500
      `).all();

      res.json({ ok: true, missions });

    } catch (error) {
      console.error("BETTING MISSIONS ERROR:", error);

      res.status(500).json({
        ok: false,
        error: "BETTING_MISSIONS_ERROR"
      });
    }
  });


  /*
   * ==========================================
   * CONFIGURAÇÕES
   * ==========================================
   */

  app.get("/api/admin/betting-protection/settings", requireAdmin, (req, res) => {
    try {
      const settings = db.prepare(`
        SELECT *
        FROM betting_protection_settings
        ORDER BY setting_key
      `).all();

      res.json({ ok: true, settings });

    } catch (error) {
      console.error("BETTING SETTINGS ERROR:", error);

      res.status(500).json({
        ok: false,
        error: "BETTING_SETTINGS_ERROR"
      });
    }
  });


  app.put("/api/admin/betting-protection/settings/:key", requireAdmin, (req, res) => {
    try {
      const key = String(req.params.key).trim();
      const value = req.body?.value;

      if (!key) {
        return res.status(400).json({
          ok: false,
          error: "SETTING_KEY_REQUIRED"
        });
      }

      db.prepare(`
        INSERT INTO betting_protection_settings
        (setting_key, setting_value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(setting_key)
        DO UPDATE SET
          setting_value = excluded.setting_value,
          updated_at = CURRENT_TIMESTAMP
      `).run(
        key,
        value === undefined ? "" : String(value)
      );

      audit(
        req,
        "admin.betting.setting_updated",
        "betting_protection_setting",
        key,
        { value }
      );

      res.json({ ok: true });

    } catch (error) {
      console.error("BETTING SETTING UPDATE ERROR:", error);

      res.status(500).json({
        ok: false,
        error: "BETTING_SETTING_UPDATE_ERROR"
      });
    }
  });

}

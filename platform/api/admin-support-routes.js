import crypto from "node:crypto";
import { db } from "./database.js";

function makeId() {
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
    console.error("SUPPORT AUDIT ERROR:", error.message);
  }
}

export function registerAdminSupportRoutes(app, requireAdmin) {

  /*
   * ==========================================================
   * EMERGÊNCIA
   * ==========================================================
   */

  app.get(
    "/api/admin/emergency",
    requireAdmin,
    (req, res) => {
      try {
        const limit = Math.min(
          Number(req.query.limit || 50),
          200
        );

        const rows = db.prepare(`
          SELECT
            id,
            user_id AS userId,
            device_id AS deviceId,
            type,
            severity,
            title,
            description,
            metadata,
            resolved,
            created_at AS createdAt,
            resolved_at AS resolvedAt
          FROM security_events
          WHERE
            LOWER(COALESCE(type, '')) LIKE '%emergency%'
            OR LOWER(COALESCE(type, '')) LIKE '%sos%'
            OR LOWER(COALESCE(type, '')) LIKE '%betting%'
            OR LOWER(COALESCE(type, '')) LIKE '%relapse%'
            OR LOWER(COALESCE(title, '')) LIKE '%emerg%'
            OR LOWER(COALESCE(title, '')) LIKE '%sos%'
          ORDER BY id DESC
          LIMIT ?
        `).all(limit);

        return res.json({
          ok: true,
          events: rows
        });

      } catch (error) {
        console.error("ADMIN EMERGENCY ERROR:", error);

        return res.status(500).json({
          ok: false,
          error: "ADMIN_EMERGENCY_ERROR"
        });
      }
    }
  );


  /*
   * Criar evento de emergência manualmente pelo Admin.
   *
   * Isso não representa uma emergência real de usuário.
   * Serve para testes/operação administrativa.
   */

  app.post(
    "/api/admin/emergency",
    requireAdmin,
    (req, res) => {
      try {
        const {
          userId = null,
          deviceId = null,
          type = "emergency",
          severity = "high",
          title = "Emergência Resgata+",
          description = "",
          metadata = {}
        } = req.body || {};

        const result = db.prepare(`
          INSERT INTO security_events
          (
            user_id,
            device_id,
            type,
            severity,
            title,
            description,
            metadata,
            resolved,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
        `).run(
          userId,
          deviceId,
          type,
          severity,
          title,
          description,
          JSON.stringify(metadata)
        );

        audit(
          req,
          "admin.emergency.created",
          "security_event",
          result.lastInsertRowid,
          {
            userId,
            deviceId,
            type,
            severity
          }
        );

        return res.status(201).json({
          ok: true,
          id: result.lastInsertRowid
        });

      } catch (error) {
        console.error(
          "ADMIN EMERGENCY CREATE ERROR:",
          error
        );

        return res.status(500).json({
          ok: false,
          error: "ADMIN_EMERGENCY_CREATE_ERROR"
        });
      }
    }
  );


  /*
   * Resolver emergência/evento.
   */

  app.patch(
    "/api/admin/emergency/:id/resolve",
    requireAdmin,
    (req, res) => {
      try {

        const result = db.prepare(`
          UPDATE security_events
          SET
            resolved = 1,
            resolved_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(req.params.id);

        if (!result.changes) {
          return res.status(404).json({
            ok: false,
            error: "EMERGENCY_NOT_FOUND"
          });
        }

        audit(
          req,
          "admin.emergency.resolved",
          "security_event",
          req.params.id
        );

        return res.json({
          ok: true
        });

      } catch (error) {
        console.error(
          "ADMIN EMERGENCY RESOLVE ERROR:",
          error
        );

        return res.status(500).json({
          ok: false,
          error: "ADMIN_EMERGENCY_RESOLVE_ERROR"
        });
      }
    }
  );


  /*
   * ==========================================================
   * SUGESTÕES
   * ==========================================================
   */

  app.get(
    "/api/admin/suggestions",
    requireAdmin,
    (req, res) => {
      try {

        const status =
          req.query.status
            ? String(req.query.status)
            : null;

        const limit = Math.min(
          Number(req.query.limit || 100),
          500
        );

        let rows;

        if (status) {

          rows = db.prepare(`
            SELECT
              id,
              usuario_id AS userId,
              categoria AS category,
              texto AS text,
              status,
              votos AS votes,
              criado_em AS createdAt
            FROM sugestoes_resgata
            WHERE status = ?
            ORDER BY id DESC
            LIMIT ?
          `).all(status, limit);

        } else {

          rows = db.prepare(`
            SELECT
              id,
              usuario_id AS userId,
              categoria AS category,
              texto AS text,
              status,
              votos AS votes,
              criado_em AS createdAt
            FROM sugestoes_resgata
            ORDER BY id DESC
            LIMIT ?
          `).all(limit);
        }

        return res.json({
          ok: true,
          suggestions: rows
        });

      } catch (error) {
        console.error(
          "ADMIN SUGGESTIONS ERROR:",
          error
        );

        return res.status(500).json({
          ok: false,
          error: "ADMIN_SUGGESTIONS_ERROR"
        });
      }
    }
  );


  /*
   * Criar sugestão pelo Admin.
   */

  app.post(
    "/api/admin/suggestions",
    requireAdmin,
    (req, res) => {
      try {

        const {
          userId = null,
          category = "outros",
          text
        } = req.body || {};

        if (!text || !String(text).trim()) {
          return res.status(400).json({
            ok: false,
            error: "SUGGESTION_TEXT_REQUIRED"
          });
        }

        const result = db.prepare(`
          INSERT INTO sugestoes_resgata
          (
            usuario_id,
            categoria,
            texto,
            status,
            votos
          )
          VALUES (?, ?, ?, 'recebida', 0)
        `).run(
          userId,
          category,
          String(text).trim()
        );

        audit(
          req,
          "admin.suggestion.created",
          "suggestion",
          result.lastInsertRowid,
          {
            userId,
            category
          }
        );

        return res.status(201).json({
          ok: true,
          id: result.lastInsertRowid
        });

      } catch (error) {
        console.error(
          "ADMIN SUGGESTION CREATE ERROR:",
          error
        );

        return res.status(500).json({
          ok: false,
          error: "ADMIN_SUGGESTION_CREATE_ERROR"
        });
      }
    }
  );


  /*
   * Alterar status da sugestão.
   */

  app.patch(
    "/api/admin/suggestions/:id",
    requireAdmin,
    (req, res) => {
      try {

        const allowed = [
          "recebida",
          "em_analise",
          "planejada",
          "em_desenvolvimento",
          "disponivel",
          "nao_incluida"
        ];

        const status =
          String(req.body?.status || "");

        if (!allowed.includes(status)) {
          return res.status(400).json({
            ok: false,
            error: "INVALID_SUGGESTION_STATUS",
            allowed
          });
        }

        const result = db.prepare(`
          UPDATE sugestoes_resgata
          SET status = ?
          WHERE id = ?
        `).run(
          status,
          req.params.id
        );

        if (!result.changes) {
          return res.status(404).json({
            ok: false,
            error: "SUGGESTION_NOT_FOUND"
          });
        }

        audit(
          req,
          "admin.suggestion.status_updated",
          "suggestion",
          req.params.id,
          { status }
        );

        return res.json({
          ok: true
        });

      } catch (error) {
        console.error(
          "ADMIN SUGGESTION UPDATE ERROR:",
          error
        );

        return res.status(500).json({
          ok: false,
          error: "ADMIN_SUGGESTION_UPDATE_ERROR"
        });
      }
    }
  );


  /*
   * Votar em sugestão.
   */

  app.post(
    "/api/admin/suggestions/:id/vote",
    requireAdmin,
    (req, res) => {
      try {

        const result = db.prepare(`
          UPDATE sugestoes_resgata
          SET votos = COALESCE(votos, 0) + 1
          WHERE id = ?
        `).run(req.params.id);

        if (!result.changes) {
          return res.status(404).json({
            ok: false,
            error: "SUGGESTION_NOT_FOUND"
          });
        }

        audit(
          req,
          "admin.suggestion.voted",
          "suggestion",
          req.params.id
        );

        const row = db.prepare(`
          SELECT
            id,
            votos AS votes
          FROM sugestoes_resgata
          WHERE id = ?
        `).get(req.params.id);

        return res.json({
          ok: true,
          votes: row?.votes ?? 0
        });

      } catch (error) {
        console.error(
          "ADMIN SUGGESTION VOTE ERROR:",
          error
        );

        return res.status(500).json({
          ok: false,
          error: "ADMIN_SUGGESTION_VOTE_ERROR"
        });
      }
    }
  );


  /*
   * ==========================================================
   * CONTEÚDO
   * ==========================================================
   */

  app.get(
    "/api/admin/content",
    requireAdmin,
    (req, res) => {
      try {

        const tableExists = db.prepare(`
          SELECT name
          FROM sqlite_master
          WHERE type = 'table'
            AND name = 'resgata_conteudos'
        `).get();

        if (!tableExists) {
          return res.json({
            ok: true,
            content: [],
            available: false,
            message:
              "Tabela de conteúdo ainda não criada."
          });
        }

        const limit = Math.min(
          Number(req.query.limit || 100),
          500
        );

        const rows = db.prepare(`
          SELECT
            id,
            titulo AS title,
            categoria AS category,
            tipo AS type,
            descricao AS description,
            conteudo AS content,
            ativo AS enabled,
            criado_em AS createdAt,
            atualizado_em AS updatedAt
          FROM resgata_conteudos
          ORDER BY id DESC
          LIMIT ?
        `).all(limit);

        return res.json({
          ok: true,
          content: rows,
          available: true
        });

      } catch (error) {
        console.error(
          "ADMIN CONTENT ERROR:",
          error
        );

        return res.status(500).json({
          ok: false,
          error: "ADMIN_CONTENT_ERROR"
        });
      }
    }
  );


  app.post(
    "/api/admin/content",
    requireAdmin,
    (req, res) => {
      try {

        const tableExists = db.prepare(`
          SELECT name
          FROM sqlite_master
          WHERE type = 'table'
            AND name = 'resgata_conteudos'
        `).get();

        if (!tableExists) {
          return res.status(503).json({
            ok: false,
            error: "CONTENT_TABLE_NOT_READY"
          });
        }

        const {
          title,
          category = "geral",
          type = "texto",
          description = "",
          content = "",
          enabled = 1
        } = req.body || {};

        if (!title || !String(title).trim()) {
          return res.status(400).json({
            ok: false,
            error: "CONTENT_TITLE_REQUIRED"
          });
        }

        const result = db.prepare(`
          INSERT INTO resgata_conteudos
          (
            titulo,
            categoria,
            tipo,
            descricao,
            conteudo,
            ativo,
            criado_em,
            atualizado_em
          )
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(
          String(title).trim(),
          String(category),
          String(type),
          String(description),
          String(content),
          enabled ? 1 : 0
        );

        audit(
          req,
          "admin.content.created",
          "content",
          result.lastInsertRowid,
          { category, type }
        );

        return res.status(201).json({
          ok: true,
          id: result.lastInsertRowid
        });

      } catch (error) {
        console.error(
          "ADMIN CONTENT CREATE ERROR:",
          error
        );

        return res.status(500).json({
          ok: false,
          error: "ADMIN_CONTENT_CREATE_ERROR"
        });
      }
    }
  );


  app.patch(
    "/api/admin/content/:id",
    requireAdmin,
    (req, res) => {
      try {

        const fields = [];
        const values = [];

        const allowed = {
          title: "titulo",
          category: "categoria",
          type: "tipo",
          description: "descricao",
          content: "conteudo",
          enabled: "ativo"
        };

        for (const [key, column] of Object.entries(allowed)) {

          if (req.body?.[key] === undefined) {
            continue;
          }

          fields.push(`${column} = ?`);

          if (key === "enabled") {
            values.push(req.body[key] ? 1 : 0);
          } else {
            values.push(req.body[key]);
          }
        }

        if (!fields.length) {
          return res.status(400).json({
            ok: false,
            error: "NO_CONTENT_FIELDS"
          });
        }

        fields.push("atualizado_em = CURRENT_TIMESTAMP");

        values.push(req.params.id);

        const result = db.prepare(`
          UPDATE resgata_conteudos
          SET ${fields.join(", ")}
          WHERE id = ?
        `).run(...values);

        if (!result.changes) {
          return res.status(404).json({
            ok: false,
            error: "CONTENT_NOT_FOUND"
          });
        }

        audit(
          req,
          "admin.content.updated",
          "content",
          req.params.id
        );

        return res.json({
          ok: true
        });

      } catch (error) {
        console.error(
          "ADMIN CONTENT UPDATE ERROR:",
          error
        );

        return res.status(500).json({
          ok: false,
          error: "ADMIN_CONTENT_UPDATE_ERROR"
        });
      }
    }
  );


  console.log(
    "ADMIN SUPPORT: emergência, sugestões e conteúdo registrados."
  );
}

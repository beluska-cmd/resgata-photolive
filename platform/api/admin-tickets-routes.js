import express from "express";
import crypto from "crypto";
import { db } from "./database.js";

const router = express.Router();

function audit(adminId, action, entityId, details = {}) {
  db.prepare(`
    INSERT INTO audit_logs
      (user_id, action, entity, entity_id, details)
    VALUES
      (NULL, ?, 'ticket', ?, ?)
  `).run(
    action,
    entityId,
    JSON.stringify({
      adminId,
      ...details
    })
  );
}

function getTicket(id) {
  return db.prepare(`
    SELECT
      t.*,
      u.name AS user_name,
      u.email AS user_email,
      u.plan AS user_plan,
      u.status AS user_status
    FROM tickets t
    LEFT JOIN users u
      ON u.id = t.user_id
    WHERE t.id = ?
  `).get(id);
}

/* =========================================================
   LISTAR ATENDIMENTOS
   GET /api/admin/tickets
========================================================= */

router.get("/", (req, res) => {
  try {
    const {
      search = "",
      status = "",
      priority = "",
      limit = "500"
    } = req.query;

    const params = [];
    const where = [];

    if (status) {
      where.push("t.status = ?");
      params.push(String(status));
    }

    if (priority) {
      where.push("t.priority = ?");
      params.push(String(priority));
    }

    if (search) {
      const q = `%${String(search).trim()}%`;

      where.push(`
        (
          t.id LIKE ?
          OR t.subject LIKE ?
          OR t.message LIKE ?
          OR u.name LIKE ?
          OR u.email LIKE ?
        )
      `);

      params.push(q, q, q, q, q);
    }

    const safeLimit = Math.min(
      Math.max(Number(limit) || 500, 1),
      500
    );

    const sql = `
      SELECT
        t.*,
        u.name AS user_name,
        u.email AS user_email
      FROM tickets t
      LEFT JOIN users u
        ON u.id = t.user_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY t.created_at DESC
      LIMIT ?
    `;

    params.push(safeLimit);

    const tickets = db.prepare(sql).all(...params);

    res.json({
      ok: true,
      tickets,
      total: tickets.length
    });
  } catch (error) {
    console.error("ADMIN TICKETS LIST ERROR:", error);

    res.status(500).json({
      ok: false,
      error: "TICKETS_LIST_ERROR"
    });
  }
});

/* =========================================================
   RESUMO
   GET /api/admin/tickets/summary
========================================================= */

router.get("/summary", (req, res) => {
  try {
    const total = db.prepare(`
      SELECT COUNT(*) AS total
      FROM tickets
    `).get().total;

    const byStatus = db.prepare(`
      SELECT
        status,
        COUNT(*) AS total
      FROM tickets
      GROUP BY status
      ORDER BY total DESC
    `).all();

    const byPriority = db.prepare(`
      SELECT
        priority,
        COUNT(*) AS total
      FROM tickets
      GROUP BY priority
      ORDER BY total DESC
    `).all();

    res.json({
      ok: true,
      summary: {
        total,
        byStatus,
        byPriority
      }
    });
  } catch (error) {
    console.error("ADMIN TICKETS SUMMARY ERROR:", error);

    res.status(500).json({
      ok: false,
      error: "TICKETS_SUMMARY_ERROR"
    });
  }
});

/* =========================================================
   DETALHES
   GET /api/admin/tickets/:id
========================================================= */


router.get("/:id/messages", (req, res) => {
  try {
    const ticket = db.prepare(`
      SELECT id
      FROM tickets
      WHERE id = ?
    `).get(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        ok: false,
        error: "TICKET_NOT_FOUND"
      });
    }

    const messages = db.prepare(`
      SELECT
        id,
        ticket_id,
        sender_type,
        sender_id,
        message,
        internal,
        created_at,
        updated_at
      FROM ticket_messages
      WHERE ticket_id = ?
      ORDER BY created_at ASC, id ASC
    `).all(req.params.id);

    res.json({
      ok: true,
      messages
    });
  } catch (error) {
    console.error("ADMIN TICKET MESSAGES GET ERROR:", error);

    res.status(500).json({
      ok: false,
      error: "TICKET_MESSAGES_LOAD_ERROR"
    });
  }
});

router.post("/:id/messages", (req, res) => {
  try {
    const ticket = db.prepare(`
      SELECT id, status
      FROM tickets
      WHERE id = ?
    `).get(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        ok: false,
        error: "TICKET_NOT_FOUND"
      });
    }

    const message = String(
      req.body?.message || ""
    ).trim();

    const internal =
      req.body?.internal === true ||
      req.body?.internal === 1 ||
      req.body?.internal === "1";

    if (!message) {
      return res.status(400).json({
        ok: false,
        error: "MESSAGE_REQUIRED"
      });
    }

    if (message.length > 5000) {
      return res.status(400).json({
        ok: false,
        error: "MESSAGE_TOO_LONG"
      });
    }

    const messageId = crypto.randomUUID();
    const adminId = req.admin?.id || null;

    db.prepare(`
      INSERT INTO ticket_messages (
        id,
        ticket_id,
        sender_type,
        sender_id,
        message,
        internal
      )
      VALUES (?, ?, 'admin', ?, ?, ?)
    `).run(
      messageId,
      req.params.id,
      adminId,
      message,
      internal ? 1 : 0
    );

    db.prepare(`
      UPDATE tickets
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.params.id);

    audit(
      adminId,
      internal
        ? "admin.ticket.internal_message_created"
        : "admin.ticket.message_created",
      req.params.id,
      {
        messageId,
        internal
      }
    );

    const created = db.prepare(`
      SELECT
        id,
        ticket_id,
        sender_type,
        sender_id,
        message,
        internal,
        created_at,
        updated_at
      FROM ticket_messages
      WHERE id = ?
    `).get(messageId);

    res.status(201).json({
      ok: true,
      message: created
    });
  } catch (error) {
    console.error("ADMIN TICKET MESSAGE POST ERROR:", error);

    res.status(500).json({
      ok: false,
      error: "TICKET_MESSAGE_CREATE_ERROR"
    });
  }
});

router.get("/:id", (req, res) => {
  try {
    const ticket = getTicket(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        ok: false,
        error: "TICKET_NOT_FOUND"
      });
    }

    const assignments = db.prepare(`
      SELECT
        sa.*,
        s.name AS specialist_name,
        s.email AS specialist_email,
        s.phone AS specialist_phone,
        s.specialty AS specialist_specialty
      FROM service_assignments sa
      LEFT JOIN specialists s
        ON s.id = sa.specialist_id
      WHERE sa.ticket_id = ?
      ORDER BY sa.created_at DESC
    `).all(req.params.id);

    const auditRows = db.prepare(`
      SELECT
        id,
        action,
        entity,
        entity_id,
        details,
        created_at
      FROM audit_logs
      WHERE entity = 'ticket'
        AND entity_id = ?
      ORDER BY id DESC
      LIMIT 100
    `).all(req.params.id);

    res.json({
      ok: true,
      ticket,
      assignments,
      audit: auditRows
    });
  } catch (error) {
    console.error("ADMIN TICKET DETAIL ERROR:", error);

    res.status(500).json({
      ok: false,
      error: "TICKET_DETAIL_ERROR"
    });
  }
});

/* =========================================================
   CRIAR ATENDIMENTO
   POST /api/admin/tickets
========================================================= */

router.post("/", (req, res) => {
  try {
    const {
      userId = null,
      subject,
      message = "",
      priority = "normal",
      status = "open"
    } = req.body || {};

    const cleanSubject = String(subject || "").trim();
    const cleanMessage = String(message || "").trim();

    const allowedStatus = [
      "open",
      "in_progress",
      "waiting_user",
      "waiting_specialist",
      "resolved",
      "closed",
      "cancelled"
    ];

    const allowedPriority = [
      "low",
      "normal",
      "high",
      "urgent"
    ];

    if (!cleanSubject) {
      return res.status(400).json({
        ok: false,
        error: "SUBJECT_REQUIRED"
      });
    }

    if (!allowedStatus.includes(status)) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_TICKET_STATUS"
      });
    }

    if (!allowedPriority.includes(priority)) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_TICKET_PRIORITY"
      });
    }

    if (userId) {
      const user = db.prepare(`
        SELECT id
        FROM users
        WHERE id = ?
      `).get(userId);

      if (!user) {
        return res.status(404).json({
          ok: false,
          error: "USER_NOT_FOUND"
        });
      }
    }

    const ticketId = crypto.randomUUID();

    db.prepare(`
      INSERT INTO tickets (
        id,
        user_id,
        subject,
        message,
        priority,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      ticketId,
      userId || null,
      cleanSubject,
      cleanMessage,
      priority,
      status
    );

    audit(
      req.admin.id,
      "admin.ticket.created",
      ticketId,
      {
        status,
        priority
      }
    );

    const ticket = getTicket(ticketId);

    res.status(201).json({
      ok: true,
      ticket
    });
  } catch (error) {
    console.error("ADMIN TICKET CREATE ERROR:", error);

    res.status(500).json({
      ok: false,
      error: "TICKET_CREATE_ERROR"
    });
  }
});

/* =========================================================
   ALTERAR STATUS
   PATCH /api/admin/tickets/:id/status
========================================================= */

router.patch("/:id/status", (req, res) => {
  try {
    const allowed = [
      "open",
      "in_progress",
      "waiting_user",
      "waiting_specialist",
      "resolved",
      "closed",
      "cancelled"
    ];

    const status = String(req.body?.status || "").trim();

    if (!allowed.includes(status)) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_TICKET_STATUS",
        allowed
      });
    }

    const ticket = db.prepare(`
      SELECT *
      FROM tickets
      WHERE id = ?
    `).get(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        ok: false,
        error: "TICKET_NOT_FOUND"
      });
    }

    db.prepare(`
      UPDATE tickets
      SET
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      status,
      req.params.id
    );

    audit(
      req.admin.id,
      "admin.ticket.status_updated",
      req.params.id,
      {
        previousStatus: ticket.status,
        status
      }
    );

    res.json({
      ok: true,
      ticket: getTicket(req.params.id)
    });
  } catch (error) {
    console.error("ADMIN TICKET STATUS ERROR:", error);

    res.status(500).json({
      ok: false,
      error: "TICKET_STATUS_UPDATE_ERROR"
    });
  }
});

/* =========================================================
   ALTERAR PRIORIDADE
   PATCH /api/admin/tickets/:id/priority
========================================================= */

router.patch("/:id/priority", (req, res) => {
  try {
    const allowed = [
      "low",
      "normal",
      "high",
      "urgent"
    ];

    const priority = String(req.body?.priority || "").trim();

    if (!allowed.includes(priority)) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_TICKET_PRIORITY",
        allowed
      });
    }

    const ticket = db.prepare(`
      SELECT *
      FROM tickets
      WHERE id = ?
    `).get(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        ok: false,
        error: "TICKET_NOT_FOUND"
      });
    }

    db.prepare(`
      UPDATE tickets
      SET
        priority = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      priority,
      req.params.id
    );

    audit(
      req.admin.id,
      "admin.ticket.priority_updated",
      req.params.id,
      {
        previousPriority: ticket.priority,
        priority
      }
    );

    res.json({
      ok: true,
      ticket: getTicket(req.params.id)
    });
  } catch (error) {
    console.error("ADMIN TICKET PRIORITY ERROR:", error);

    res.status(500).json({
      ok: false,
      error: "TICKET_PRIORITY_UPDATE_ERROR"
    });
  }
});

/* =========================================================
   ATRIBUIR ESPECIALISTA
   POST /api/admin/tickets/:id/assign
========================================================= */

router.post("/:id/assign", (req, res) => {
  try {
    const specialistId = String(
      req.body?.specialistId || ""
    ).trim();

    const notes = String(
      req.body?.notes || ""
    ).trim();

    if (!specialistId) {
      return res.status(400).json({
        ok: false,
        error: "SPECIALIST_ID_REQUIRED"
      });
    }

    const ticket = db.prepare(`
      SELECT *
      FROM tickets
      WHERE id = ?
    `).get(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        ok: false,
        error: "TICKET_NOT_FOUND"
      });
    }

    const specialist = db.prepare(`
      SELECT
        id,
        name,
        email,
        phone,
        specialty,
        status,
        availability
      FROM specialists
      WHERE id = ?
    `).get(specialistId);

    if (!specialist) {
      return res.status(404).json({
        ok: false,
        error: "SPECIALIST_NOT_FOUND"
      });
    }

    const existing = db.prepare(`
      SELECT *
      FROM service_assignments
      WHERE ticket_id = ?
        AND status = 'assigned'
      ORDER BY created_at DESC
      LIMIT 1
    `).get(req.params.id);

    if (existing) {
      db.prepare(`
        UPDATE service_assignments
        SET
          specialist_id = ?,
          notes = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        specialistId,
        notes || existing.notes || null,
        existing.id
      );

      audit(
        req.admin.id,
        "admin.ticket.assignment_updated",
        req.params.id,
        {
          specialistId,
          assignmentId: existing.id
        }
      );
    } else {
      const assignmentId = crypto.randomUUID();

      db.prepare(`
        INSERT INTO service_assignments (
          id,
          ticket_id,
          specialist_id,
          status,
          notes
        )
        VALUES (?, ?, ?, 'assigned', ?)
      `).run(
        assignmentId,
        req.params.id,
        specialistId,
        notes || null
      );

      audit(
        req.admin.id,
        "admin.ticket.assigned",
        req.params.id,
        {
          specialistId,
          assignmentId
        }
      );
    }

    if (ticket.status === "open") {
      db.prepare(`
        UPDATE tickets
        SET
          status = 'waiting_specialist',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(req.params.id);

      audit(
        req.admin.id,
        "admin.ticket.status_updated",
        req.params.id,
        {
          previousStatus: "open",
          status: "waiting_specialist",
          reason: "specialist_assigned"
        }
      );
    }

    res.json({
      ok: true,
      ticket: getTicket(req.params.id),
      specialist
    });
  } catch (error) {
    console.error("ADMIN TICKET ASSIGN ERROR:", error);

    res.status(500).json({
      ok: false,
      error: "TICKET_ASSIGN_ERROR"
    });
  }
});

/* =========================================================
   DESATRIBUIR ESPECIALISTA
   POST /api/admin/tickets/:id/unassign
========================================================= */

router.post("/:id/unassign", (req, res) => {
  try {
    const assignment = db.prepare(`
      SELECT *
      FROM service_assignments
      WHERE ticket_id = ?
        AND status = 'assigned'
      ORDER BY created_at DESC
      LIMIT 1
    `).get(req.params.id);

    if (!assignment) {
      return res.status(404).json({
        ok: false,
        error: "ACTIVE_ASSIGNMENT_NOT_FOUND"
      });
    }

    db.prepare(`
      UPDATE service_assignments
      SET
        status = 'cancelled',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(assignment.id);

    audit(
      req.admin.id,
      "admin.ticket.unassigned",
      req.params.id,
      {
        assignmentId: assignment.id,
        specialistId: assignment.specialist_id
      }
    );

    res.json({
      ok: true,
      ticket: getTicket(req.params.id)
    });
  } catch (error) {
    console.error("ADMIN TICKET UNASSIGN ERROR:", error);

    res.status(500).json({
      ok: false,
      error: "TICKET_UNASSIGN_ERROR"
    });
  }
});

export default router;

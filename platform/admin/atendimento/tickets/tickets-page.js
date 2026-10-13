(() => {
  "use strict";

  const API_BASE = "/api/admin";

  const state = {
    tickets: [],
    loading: false,
    search: "",
    status: "",
    priority: ""
  };

  function token() {
    return localStorage.getItem("resgata_admin_token") || "";
  }

  async function api(path, options = {}) {
    const headers = {
      Accept: "application/json",
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...(options.headers || {})
    };

    const currentToken = token();

    if (currentToken) {
      headers.Authorization = `Bearer ${currentToken}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok || data.ok === false) {
      const error = new Error(
        data.error ||
        data.message ||
        `HTTP_${response.status}`
      );

      error.status = response.status;
      error.data = data;

      throw error;
    }

    return data;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function statusLabel(status) {
    const labels = {
      open: "Aberto",
      in_progress: "Em atendimento",
      waiting_user: "Aguardando cliente",
      waiting_specialist: "Aguardando especialista",
      resolved: "Resolvido",
      closed: "Fechado",
      cancelled: "Cancelado"
    };

    return labels[status] || status || "—";
  }

  function priorityLabel(priority) {
    const labels = {
      low: "Baixa",
      normal: "Normal",
      high: "Alta",
      urgent: "Urgente"
    };

    return labels[priority] || priority || "Normal";
  }

  function formatDate(value) {
    if (!value) return "—";

    let date;

    if (typeof value === "number" || /^\d+$/.test(String(value))) {
      const numeric = Number(value);

      date = new Date(
        numeric < 100000000000
          ? numeric * 1000
          : numeric
      );
    } else {
      date = new Date(value);
    }

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    });
  }

  function statusClass(status) {
    return `status-${String(status || "open")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")}`;
  }

  function priorityClass(priority) {
    return `priority-${String(priority || "normal")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")}`;
  }

  function showListState(message, type = "loading") {
    const list = document.getElementById("tickets-list");

    if (!list) return;

    list.innerHTML = `
      <div class="tickets-state tickets-state-${type}">
        <div class="tickets-state-icon">
          ${type === "error" ? "⚠️" : type === "empty" ? "📭" : "⏳"}
        </div>
        <strong>${escapeHtml(message)}</strong>
      </div>
    `;
  }

  function getTicketId(ticket) {
    return ticket.id || ticket.ticket_id || "";
  }

  function getUserName(ticket) {
    return (
      ticket.user_name ||
      ticket.user?.name ||
      ticket.name ||
      "Cliente não identificado"
    );
  }

  function getUserEmail(ticket) {
    return (
      ticket.user_email ||
      ticket.user?.email ||
      ticket.email ||
      ""
    );
  }

  function renderSummary(data) {
    const summary = data?.summary || data?.data || data || {};

    const total =
      summary.total ??
      summary.count ??
      state.tickets.length;

    const open =
      summary.open ??
      state.tickets.filter(t => t.status === "open").length;

    const inProgress =
      summary.in_progress ??
      state.tickets.filter(t => t.status === "in_progress").length;

    const closed =
      summary.closed ??
      state.tickets.filter(t =>
        ["closed", "resolved", "cancelled"].includes(t.status)
      ).length;

    const elements = {
      total: document.getElementById("summary-total"),
      open: document.getElementById("summary-open"),
      progress: document.getElementById("summary-progress"),
      closed: document.getElementById("summary-closed")
    };

    if (elements.total) elements.total.textContent = total;
    if (elements.open) elements.open.textContent = open;
    if (elements.progress) elements.progress.textContent = inProgress;
    if (elements.closed) elements.closed.textContent = closed;
  }

  function renderTickets() {
    const list = document.getElementById("tickets-list");

    if (!list) return;

    if (!state.tickets.length) {
      showListState(
        "Nenhum ticket encontrado com os filtros atuais.",
        "empty"
      );
      return;
    }

    list.innerHTML = state.tickets.map(ticket => {
      const id = getTicketId(ticket);
      const userName = getUserName(ticket);
      const userEmail = getUserEmail(ticket);

      return `
        <article
          class="ticket-row"
          data-ticket-id="${escapeHtml(id)}"
        >
          <div class="ticket-main">
            <div class="ticket-title-line">
              <h3>${escapeHtml(
                ticket.subject || "Sem assunto"
              )}</h3>

              <span class="ticket-status ${statusClass(ticket.status)}">
                ${escapeHtml(statusLabel(ticket.status))}
              </span>
            </div>

            <p class="ticket-message">
              ${escapeHtml(ticket.message || "Sem mensagem inicial.")}
            </p>

            <div class="ticket-meta">
              <span>👤 ${escapeHtml(userName)}</span>
              ${
                userEmail
                  ? `<span>✉️ ${escapeHtml(userEmail)}</span>`
                  : ""
              }
              <span>🕒 ${escapeHtml(formatDate(
                ticket.created_at
              ))}</span>
              <span class="ticket-priority ${priorityClass(ticket.priority)}">
                ${escapeHtml(priorityLabel(ticket.priority))}
              </span>
            </div>
          </div>

          <div class="ticket-actions">
            <button
              type="button"
              class="ticket-open-button"
              data-open-ticket="${escapeHtml(id)}"
            >
              Abrir →
            </button>
          </div>
        </article>
      `;
    }).join("");
  }

  async function loadSummary() {
    try {
      const data = await api("/tickets/summary");
      renderSummary(data);
    } catch (error) {
      console.warn(
        "Não foi possível carregar o resumo dos tickets:",
        error
      );

      renderSummary({});
    }
  }

  async function loadTickets() {
    if (state.loading) return;

    state.loading = true;
    showListState("Carregando tickets...");

    try {
      const params = new URLSearchParams();

      if (state.search) {
        params.set("search", state.search);
      }

      if (state.status) {
        params.set("status", state.status);
      }

      if (state.priority) {
        params.set("priority", state.priority);
      }

      params.set("limit", "100");

      const query = params.toString();

      const data = await api(
        `/tickets${query ? `?${query}` : ""}`
      );

      state.tickets =
        data.tickets ||
        data.data ||
        data.results ||
        [];

      renderTickets();

      await loadSummary();

    } catch (error) {
      console.error(
        "RESGATA TICKETS PAGE ERROR:",
        error
      );

      showListState(
        error.data?.error ||
        "Não foi possível carregar os tickets.",
        "error"
      );

    } finally {
      state.loading = false;
    }
  }

  function openTicket(id) {
    if (!id) return;

    window.location.href =
      `/admin/atendimento/chat/?ticket=${encodeURIComponent(id)}`;
  }

  function bindEvents() {
    const search = document.getElementById("ticket-search");
    const status = document.getElementById("ticket-status");
    const priority = document.getElementById("ticket-priority");
    const refresh = document.getElementById("ticket-refresh");
    const list = document.getElementById("tickets-list");

    let searchTimer = null;

    search?.addEventListener("input", event => {
      clearTimeout(searchTimer);

      searchTimer = setTimeout(() => {
        state.search = event.target.value.trim();
        loadTickets();
      }, 350);
    });

    status?.addEventListener("change", event => {
      state.status = event.target.value;
      loadTickets();
    });

    priority?.addEventListener("change", event => {
      state.priority = event.target.value;
      loadTickets();
    });

    refresh?.addEventListener("click", () => {
      loadTickets();
    });

    list?.addEventListener("click", event => {
      const button = event.target.closest(
        "[data-open-ticket]"
      );

      if (!button) return;

      openTicket(button.dataset.openTicket);
    });
  }

  function init() {
    bindEvents();
    loadTickets();
  }

  window.ResgataTicketsPage = {
    load: loadTickets,
    open: openTicket
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

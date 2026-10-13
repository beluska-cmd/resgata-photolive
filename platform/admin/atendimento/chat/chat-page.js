(() => {
  "use strict";

  const API_BASE = "/api/admin";

  const state = {
    ticketId: "",
    ticket: null,
    messages: [],
    loading: false,
    sending: false
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

  function formatDate(value) {
    if (!value) return "—";

    let date;

    if (
      typeof value === "number" ||
      /^\d+$/.test(String(value))
    ) {
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

  function statusLabel(status) {
    return {
      open: "Aberto",
      in_progress: "Em atendimento",
      waiting_user: "Aguardando cliente",
      waiting_specialist: "Aguardando especialista",
      resolved: "Resolvido",
      closed: "Fechado",
      cancelled: "Cancelado"
    }[status] || status || "—";
  }

  function priorityLabel(priority) {
    return {
      low: "Baixa",
      normal: "Normal",
      high: "Alta",
      urgent: "Urgente"
    }[priority] || priority || "Normal";
  }

  function getTicket(data) {
    return (
      data.ticket ||
      data.data?.ticket ||
      data.data ||
      null
    );
  }

  function getMessages(data) {
    return Array.isArray(data.messages)
      ? data.messages
      : Array.isArray(data.data?.messages)
        ? data.data.messages
        : [];
  }

  function getUserName(ticket) {
    return (
      ticket?.user_name ||
      ticket?.user?.name ||
      ticket?.name ||
      "Cliente"
    );
  }

  function getUserEmail(ticket) {
    return (
      ticket?.user_email ||
      ticket?.user?.email ||
      ticket?.email ||
      ""
    );
  }

  function showState(message, type = "loading") {
    const target = document.getElementById("chat-content");

    if (!target) return;

    target.innerHTML = `
      <div class="chat-state chat-state-${escapeHtml(type)}">
        <div class="chat-state-icon">
          ${type === "error" ? "⚠️" : type === "empty" ? "💬" : "⏳"}
        </div>
        <strong>${escapeHtml(message)}</strong>
      </div>
    `;
  }

  function renderTicket() {
    const ticket = state.ticket;

    if (!ticket) {
      showState("Ticket não encontrado.", "error");
      return;
    }

    const userName = getUserName(ticket);
    const userEmail = getUserEmail(ticket);

    document.getElementById("chat-client-name").textContent =
      userName;

    document.getElementById("chat-client-email").textContent =
      userEmail || "E-mail não informado";

    document.getElementById("chat-ticket-subject").textContent =
      ticket.subject || "Sem assunto";

    document.getElementById("chat-ticket-message").textContent =
      ticket.message || "Sem mensagem inicial.";

    document.getElementById("chat-ticket-status").textContent =
      statusLabel(ticket.status);

    document.getElementById("chat-ticket-priority").textContent =
      priorityLabel(ticket.priority);

    document.getElementById("chat-ticket-created").textContent =
      formatDate(ticket.created_at);

    document.getElementById("chat-ticket-id").textContent =
      ticket.id || state.ticketId;

    document.getElementById("chat-content").innerHTML = `
      <section class="chat-layout">

        <aside class="chat-sidebar">

          <div class="chat-sidebar-card">
            <span class="chat-label">Cliente</span>

            <strong id="chat-client-name">
              ${escapeHtml(userName)}
            </strong>

            <small id="chat-client-email">
              ${escapeHtml(
                userEmail || "E-mail não informado"
              )}
            </small>
          </div>

          <div class="chat-sidebar-card">

            <span class="chat-label">Atendimento</span>

            <div class="chat-info-row">
              <span>Status</span>
              <strong id="chat-ticket-status">
                ${escapeHtml(statusLabel(ticket.status))}
              </strong>
            </div>

            <div class="chat-info-row">
              <span>Prioridade</span>
              <strong id="chat-ticket-priority">
                ${escapeHtml(priorityLabel(ticket.priority))}
              </strong>
            </div>

            <div class="chat-info-row">
              <span>Criado</span>
              <strong id="chat-ticket-created">
                ${escapeHtml(formatDate(ticket.created_at))}
              </strong>
            </div>

          </div>

        </aside>

        <main class="chat-main">

          <header class="chat-main-header">
            <div>
              <span class="chat-label">Ticket</span>

              <h2 id="chat-ticket-subject">
                ${escapeHtml(ticket.subject || "Sem assunto")}
              </h2>

              <small>
                #<span id="chat-ticket-id">
                  ${escapeHtml(ticket.id || state.ticketId)}
                </span>
              </small>
            </div>
          </header>

          <section class="chat-request">
            <span class="chat-label">Solicitação inicial</span>

            <p id="chat-ticket-message">
              ${escapeHtml(
                ticket.message || "Sem mensagem inicial."
              )}
            </p>
          </section>

          <section
            id="chat-messages"
            class="chat-messages"
            aria-live="polite"
          ></section>

          <form
            id="chat-form"
            class="chat-composer"
          >
            <textarea
              id="chat-input"
              rows="3"
              maxlength="5000"
              placeholder="Digite uma mensagem para o cliente..."
            ></textarea>

            <div class="chat-composer-footer">

              <label class="chat-internal">
                <input
                  id="chat-internal"
                  type="checkbox"
                >
                Nota interna
              </label>

              <button
                id="chat-send"
                type="submit"
              >
                Enviar mensagem
              </button>

            </div>
          </form>

        </main>

      </section>
    `;

    bindChatEvents();
    renderMessages();
  }

  function renderMessages() {
    const target = document.getElementById("chat-messages");

    if (!target) return;

    if (!state.messages.length) {
      target.innerHTML = `
        <div class="chat-empty">
          <span>💬</span>
          <strong>Nenhuma mensagem ainda</strong>
          <small>
            A conversa começará quando alguém enviar uma mensagem.
          </small>
        </div>
      `;

      return;
    }

    target.innerHTML = state.messages.map(message => {
      const senderType =
        message.sender_type || "system";

      const internal =
        Number(message.internal) === 1 ||
        message.internal === true;

      const senderLabel = {
        client: "Cliente",
        admin: "Admin",
        specialist: "Especialista",
        system: "Sistema"
      }[senderType] || senderType;

      const className =
        internal
          ? "internal"
          : senderType === "client"
            ? "client"
            : senderType === "specialist"
              ? "specialist"
              : senderType === "admin"
                ? "admin"
                : "system";

      return `
        <article class="chat-message ${className}">

          <div class="chat-message-header">
            <strong>
              ${escapeHtml(senderLabel)}
            </strong>

            ${
              internal
                ? `<span class="internal-badge">Nota interna</span>`
                : ""
            }

            <time>
              ${escapeHtml(
                formatDate(message.created_at)
              )}
            </time>
          </div>

          <div class="chat-message-body">
            ${escapeHtml(message.message)}
          </div>

        </article>
      `;
    }).join("");

    target.scrollTop = target.scrollHeight;
  }

  async function loadTicket() {
    if (!state.ticketId) {
      showState(
        "Nenhum ticket foi selecionado.",
        "empty"
      );
      return;
    }

    try {
      const data = await api(
        `/tickets/${encodeURIComponent(state.ticketId)}`
      );

      state.ticket = getTicket(data);

      if (!state.ticket) {
        throw new Error("TICKET_NOT_FOUND");
      }

      renderTicket();

      await loadMessages();

    } catch (error) {
      console.error(
        "RESGATA CHAT TICKET LOAD ERROR:",
        error
      );

      showState(
        error.data?.error ||
        "Não foi possível carregar o ticket.",
        "error"
      );
    }
  }

  async function loadMessages() {
    if (!state.ticketId) return;

    try {
      const data = await api(
        `/tickets/${encodeURIComponent(
          state.ticketId
        )}/messages`
      );

      state.messages = getMessages(data);

      renderMessages();

    } catch (error) {
      console.error(
        "RESGATA CHAT MESSAGES ERROR:",
        error
      );

      const target =
        document.getElementById("chat-messages");

      if (target) {
        target.innerHTML = `
          <div class="chat-empty chat-error">
            Não foi possível carregar a conversa.
          </div>
        `;
      }
    }
  }

  async function sendMessage(event) {
    event.preventDefault();

    if (state.sending || !state.ticketId) {
      return;
    }

    const input =
      document.getElementById("chat-input");

    const internal =
      document.getElementById("chat-internal");

    const button =
      document.getElementById("chat-send");

    if (!input || !button) return;

    const message = input.value.trim();

    if (!message) {
      input.focus();
      return;
    }

    state.sending = true;
    button.disabled = true;
    button.textContent = "Enviando...";

    try {
      await api(
        `/tickets/${encodeURIComponent(
          state.ticketId
        )}/messages`,
        {
          method: "POST",
          body: JSON.stringify({
            message,
            internal: Boolean(internal?.checked)
          })
        }
      );

      input.value = "";

      if (internal) {
        internal.checked = false;
      }

      await loadMessages();

    } catch (error) {
      console.error(
        "RESGATA CHAT SEND ERROR:",
        error
      );

      alert(
        error.data?.error ||
        "Não foi possível enviar a mensagem."
      );

    } finally {
      state.sending = false;
      button.disabled = false;
      button.textContent = "Enviar mensagem";
    }
  }

  function bindChatEvents() {
    const form =
      document.getElementById("chat-form");

    form?.addEventListener(
      "submit",
      sendMessage
    );
  }

  function getTicketIdFromUrl() {
    const params =
      new URLSearchParams(
        window.location.search
      );

    return (
      params.get("ticket") ||
      params.get("ticketId") ||
      ""
    );
  }

  function init() {
    state.ticketId = getTicketIdFromUrl();

    loadTicket();
  }

  window.ResgataChatPage = {
    load: loadTicket,
    loadMessages,
    sendMessage
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }
})();

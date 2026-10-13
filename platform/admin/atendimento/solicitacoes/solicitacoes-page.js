(() => {
  "use strict";

  const API_BASE = "/api/admin";

  const state = {
    requests: [],
    summary: null,
    detail: null,
    loading: false,
    detailLoading: false,
    searchTimer: null
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

    const response = await fetch(
      `${API_BASE}${path}`,
      {
        ...options,
        headers
      }
    );

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
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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
    const labels = {
      pending: "Pendente",
      received: "Recebida",
      in_progress: "Em andamento",
      waiting_user: "Aguardando usuário",
      waiting_specialist: "Aguardando especialista",
      resolved: "Resolvida",
      cancelled: "Cancelada",
      rejected: "Rejeitada"
    };

    return labels[status] || status || "—";
  }

  function statusClass(status) {
    return String(status || "unknown")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_");
  }

  function requestStatusOptions(selected) {
    const statuses = [
      ["pending", "Pendente"],
      ["received", "Recebida"],
      ["in_progress", "Em andamento"],
      ["waiting_user", "Aguardando usuário"],
      ["waiting_specialist", "Aguardando especialista"],
      ["resolved", "Resolvida"],
      ["cancelled", "Cancelada"],
      ["rejected", "Rejeitada"]
    ];

    return statuses
      .map(([value, label]) => `
        <option
          value="${value}"
          ${value === selected ? "selected" : ""}
        >
          ${label}
        </option>
      `)
      .join("");
  }

  function getElement(id) {
    return document.getElementById(id);
  }

  function setSummary(summary) {
    state.summary = summary || {};

    const total =
      Number(summary?.total || 0);

    const byStatus =
      summary?.byStatus || {};

    const pending =
      Number(byStatus.pending || 0);

    const progress =
      Number(byStatus.in_progress || 0) +
      Number(byStatus.received || 0);

    const waiting =
      Number(byStatus.waiting_user || 0) +
      Number(byStatus.waiting_specialist || 0);

    const resolved =
      Number(byStatus.resolved || 0);

    const values = {
      "summary-total": total,
      "summary-pending": pending,
      "summary-progress": progress,
      "summary-waiting": waiting,
      "summary-resolved": resolved
    };

    Object.entries(values).forEach(
      ([id, value]) => {
        const element = getElement(id);

        if (element) {
          element.textContent = value;
        }
      }
    );
  }

  function renderServiceFilter(summary) {
    const select =
      getElement("request-service");

    if (!select) return;

    const current =
      select.value || "";

    const services =
      Array.isArray(summary?.byService)
        ? summary.byService
        : [];

    select.innerHTML = `
      <option value="">Todos os serviços</option>
      ${services.map(item => `
        <option value="${escapeHtml(item.service_id || item.id || "")}">
          ${escapeHtml(
            item.service_name ||
            item.name ||
            "Serviço"
          )}
        </option>
      `).join("")}
    `;

    if (
      current &&
      [...select.options].some(
        option => option.value === current
      )
    ) {
      select.value = current;
    }
  }

  function renderRequests() {
    const list =
      getElement("requests-list");

    if (!list) return;

    if (state.loading) {
      list.innerHTML = `
        <div class="request-loading">
          Carregando solicitações...
        </div>
      `;

      return;
    }

    if (!state.requests.length) {
      list.innerHTML = `
        <div class="request-empty">
          <div class="request-empty-icon">📭</div>
          <h3>Nenhuma solicitação encontrada</h3>
          <p>
            Não existem solicitações correspondentes
            aos filtros atuais.
          </p>
        </div>
      `;

      return;
    }

    list.innerHTML =
      state.requests.map(request => {
        const id =
          request.id || "";

        const user =
          request.user_name ||
          request.user_email ||
          "Usuário não identificado";

        const service =
          request.service_name ||
          "Serviço não identificado";

        const device =
          request.device_name ||
          request.device_model ||
          "Sem dispositivo";

        const status =
          request.status || "pending";

        return `
          <article
            class="request-card"
            data-request-id="${escapeHtml(id)}"
            tabindex="0"
            role="button"
          >
            <div class="request-card-main">

              <div class="request-card-top">
                <span class="request-id">
                  #${escapeHtml(id.slice(0, 8))}
                </span>

                <span
                  class="request-status request-status-${statusClass(status)}"
                >
                  ${escapeHtml(statusLabel(status))}
                </span>
              </div>

              <h3>
                ${escapeHtml(service)}
              </h3>

              <p class="request-user">
                👤 ${escapeHtml(user)}
              </p>

              <p class="request-device">
                📱 ${escapeHtml(device)}
              </p>

              <p class="request-date">
                🕒 ${escapeHtml(
                  formatDate(request.created_at)
                )}
              </p>

              ${
                request.details
                  ? `
                    <p class="request-details-preview">
                      ${escapeHtml(
                        typeof request.details === "string"
                          ? request.details
                          : JSON.stringify(request.details)
                      ).slice(0, 240)}
                    </p>
                  `
                  : ""
              }
            </div>

            <div class="request-card-action">
              <button
                type="button"
                class="request-open-button"
                data-request-open="${escapeHtml(id)}"
              >
                Abrir →
              </button>
            </div>
          </article>
        `;
      }).join("");
  }

  function renderAudit(audit) {
    if (!Array.isArray(audit) || !audit.length) {
      return `
        <div class="request-audit-empty">
          Nenhum registro de histórico encontrado.
        </div>
      `;
    }

    return audit.map(item => `
      <div class="request-audit-item">
        <div>
          <strong>
            ${escapeHtml(item.action || "Evento")}
          </strong>
        </div>

        <div class="request-audit-date">
          ${escapeHtml(formatDate(item.created_at))}
        </div>

        ${
          item.details
            ? `
              <pre>${escapeHtml(
                typeof item.details === "string"
                  ? item.details
                  : JSON.stringify(
                      item.details,
                      null,
                      2
                    )
              )}</pre>
            `
            : ""
        }
      </div>
    `).join("");
  }

  function renderDetail() {
    const panel =
      getElement("request-detail");

    if (!panel) return;

    if (state.detailLoading) {
      panel.hidden = false;

      panel.innerHTML = `
        <div class="request-detail-loading">
          Carregando detalhes...
        </div>
      `;

      return;
    }

    const data =
      state.detail;

    if (!data) {
      panel.hidden = true;
      panel.innerHTML = "";
      return;
    }

    const request =
      data.request || data;

    const user =
      request.user_name ||
      request.user_email ||
      "Usuário não identificado";

    const service =
      request.service_name ||
      "Serviço não identificado";

    const detailsValue =
      typeof request.details === "string"
        ? request.details
        : JSON.stringify(
            request.details || {},
            null,
            2
          );

    panel.hidden = false;

    panel.innerHTML = `
      <div class="request-detail-header">
        <div>
          <span class="request-detail-eyebrow">
            Solicitação
          </span>

          <h2>
            #${escapeHtml(request.id || "")}
          </h2>
        </div>

        <button
          type="button"
          class="request-close-button"
          id="request-detail-close"
        >
          Fechar
        </button>
      </div>

      <div class="request-detail-grid">

        <section class="request-detail-section">
          <h3>👤 Usuário</h3>

          <div class="request-info-grid">
            <div>
              <span>Nome</span>
              <strong>
                ${escapeHtml(user)}
              </strong>
            </div>

            <div>
              <span>E-mail</span>
              <strong>
                ${escapeHtml(
                  request.user_email || "—"
                )}
              </strong>
            </div>

            <div>
              <span>Plano</span>
              <strong>
                ${escapeHtml(
                  request.user_plan || "—"
                )}
              </strong>
            </div>

            <div>
              <span>Status</span>
              <strong>
                ${escapeHtml(
                  request.user_status || "—"
                )}
              </strong>
            </div>
          </div>
        </section>

        <section class="request-detail-section">
          <h3>🛠️ Serviço</h3>

          <div class="request-info-grid">
            <div>
              <span>Serviço</span>
              <strong>
                ${escapeHtml(service)}
              </strong>
            </div>

            <div>
              <span>Categoria</span>
              <strong>
                ${escapeHtml(
                  request.service_category || "—"
                )}
              </strong>
            </div>

            <div>
              <span>Dispositivo</span>
              <strong>
                ${escapeHtml(
                  request.device_name ||
                  request.device_model ||
                  "—"
                )}
              </strong>
            </div>

            <div>
              <span>Status</span>
              <strong>
                ${escapeHtml(
                  request.device_status || "—"
                )}
              </strong>
            </div>
          </div>
        </section>

        <section class="request-detail-section">
          <h3>📋 Controle</h3>

          <div class="request-control-row">
            <label for="request-detail-status">
              Status da solicitação
            </label>

            <select id="request-detail-status">
              ${requestStatusOptions(
                request.status
              )}
            </select>

            <button
              type="button"
              class="request-save-button"
              id="request-save-status"
            >
              Salvar status
            </button>
          </div>
        </section>

        <section class="request-detail-section request-details-editor">
          <h3>📝 Detalhes</h3>

          <textarea
            id="request-details-input"
            maxlength="20000"
            rows="12"
          >${escapeHtml(detailsValue)}</textarea>

          <div class="request-editor-actions">
            <span>
              Máximo: 20.000 caracteres
            </span>

            <button
              type="button"
              class="request-save-button"
              id="request-save-details"
            >
              Salvar detalhes
            </button>
          </div>
        </section>

        <section class="request-detail-section">
          <h3>📜 Histórico</h3>

          <div class="request-audit-list">
            ${renderAudit(data.audit)}
          </div>
        </section>

      </div>
    `;

    bindDetailEvents();
  }

  async function loadSummary() {
    try {
      const data =
        await api("/requests/summary");

      setSummary(data.summary || data);
      renderServiceFilter(
        data.summary || data
      );

    } catch (error) {
      console.error(
        "RESGATA REQUEST SUMMARY ERROR:",
        error
      );
    }
  }

  async function loadRequests() {
    const search =
      getElement("request-search")?.value.trim() ||
      "";

    const status =
      getElement("request-status")?.value ||
      "";

    const serviceId =
      getElement("request-service")?.value ||
      "";

    state.loading = true;
    renderRequests();

    try {
      const params =
        new URLSearchParams();

      if (search) {
        params.set("search", search);
      }

      if (status) {
        params.set("status", status);
      }

      if (serviceId) {
        params.set("serviceId", serviceId);
      }

      const query =
        params.toString();

      const data =
        await api(
          `/requests${query ? `?${query}` : ""}`
        );

      state.requests =
        Array.isArray(data.requests)
          ? data.requests
          : [];

    } catch (error) {
      console.error(
        "RESGATA REQUEST LIST ERROR:",
        error
      );

      const list =
        getElement("requests-list");

      if (list) {
        list.innerHTML = `
          <div class="request-error">
            <h3>Não foi possível carregar as solicitações.</h3>
            <p>
              ${
                error.status === 401
                  ? "A sessão administrativa expirou. Entre novamente no Admin."
                  : escapeHtml(
                      error.data?.error ||
                      error.message ||
                      "Erro desconhecido."
                    )
              }
            </p>

            <button
              type="button"
              id="request-retry"
            >
              Tentar novamente
            </button>
          </div>
        `;

        getElement("request-retry")
          ?.addEventListener(
            "click",
            loadRequests
          );
      }

      return;

    } finally {
      state.loading = false;
      renderRequests();
    }
  }

  async function loadDetail(id) {
    if (!id) return;

    state.detailLoading = true;
    state.detail = null;

    renderDetail();

    try {
      const data =
        await api(
          `/requests/${encodeURIComponent(id)}`
        );

      state.detail = data;

      renderDetail();

      const panel =
        getElement("request-detail");

      panel?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

    } catch (error) {
      console.error(
        "RESGATA REQUEST DETAIL ERROR:",
        error
      );

      const panel =
        getElement("request-detail");

      if (panel) {
        panel.hidden = false;

        panel.innerHTML = `
          <div class="request-error">
            <h3>
              Não foi possível carregar a solicitação.
            </h3>

            <p>
              ${escapeHtml(
                error.data?.error ||
                error.message ||
                "Erro desconhecido."
              )}
            </p>
          </div>
        `;
      }

    } finally {
      state.detailLoading = false;

      if (state.detail) {
        renderDetail();
      }
    }
  }

  async function saveStatus() {
    const request =
      state.detail?.request;

    if (!request?.id) return;

    const select =
      getElement("request-detail-status");

    const button =
      getElement("request-save-status");

    if (!select || !button) return;

    const status =
      select.value;

    button.disabled = true;
    button.textContent = "Salvando...";

    try {
      const data =
        await api(
          `/requests/${encodeURIComponent(request.id)}/status`,
          {
            method: "PATCH",
            body: JSON.stringify({
              status
            })
          }
        );

      state.detail.request =
        data.request;

      await loadSummary();
      await loadRequests();
      renderDetail();

    } catch (error) {
      console.error(
        "RESGATA REQUEST STATUS ERROR:",
        error
      );

      alert(
        error.data?.error ||
        "Não foi possível atualizar o status."
      );

    } finally {
      button.disabled = false;
      button.textContent = "Salvar status";
    }
  }

  async function saveDetails() {
    const request =
      state.detail?.request;

    if (!request?.id) return;

    const textarea =
      getElement("request-details-input");

    const button =
      getElement("request-save-details");

    if (!textarea || !button) return;

    button.disabled = true;
    button.textContent = "Salvando...";

    try {
      const data =
        await api(
          `/requests/${encodeURIComponent(request.id)}/details`,
          {
            method: "PATCH",
            body: JSON.stringify({
              details: textarea.value
            })
          }
        );

      state.detail.request =
        data.request;

      await loadRequests();
      renderDetail();

    } catch (error) {
      console.error(
        "RESGATA REQUEST DETAILS ERROR:",
        error
      );

      alert(
        error.data?.error ||
        "Não foi possível salvar os detalhes."
      );

    } finally {
      button.disabled = false;
      button.textContent = "Salvar detalhes";
    }
  }

  function bindDetailEvents() {
    getElement("request-detail-close")
      ?.addEventListener(
        "click",
        () => {
          state.detail = null;
          renderDetail();
        }
      );

    getElement("request-save-status")
      ?.addEventListener(
        "click",
        saveStatus
      );

    getElement("request-save-details")
      ?.addEventListener(
        "click",
        saveDetails
      );
  }

  function bindListEvents() {
    const list =
      getElement("requests-list");

    list?.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            "[data-request-open]"
          );

        const card =
          event.target.closest(
            "[data-request-id]"
          );

        const id =
          button?.dataset.requestOpen ||
          card?.dataset.requestId;

        if (id) {
          loadDetail(id);
        }
      }
    );

    list?.addEventListener(
      "keydown",
      event => {
        if (
          event.key !== "Enter" &&
          event.key !== " "
        ) {
          return;
        }

        const card =
          event.target.closest(
            "[data-request-id]"
          );

        if (!card) return;

        event.preventDefault();

        loadDetail(
          card.dataset.requestId
        );
      }
    );
  }

  function bindFilters() {
    const search =
      getElement("request-search");

    const status =
      getElement("request-status");

    const service =
      getElement("request-service");

    const refresh =
      getElement("request-refresh");

    search?.addEventListener(
      "input",
      () => {
        clearTimeout(
          state.searchTimer
        );

        state.searchTimer =
          setTimeout(
            loadRequests,
            300
          );
      }
    );

    status?.addEventListener(
      "change",
      loadRequests
    );

    service?.addEventListener(
      "change",
      loadRequests
    );

    refresh?.addEventListener(
      "click",
      async () => {
        refresh.disabled = true;

        try {
          await loadSummary();
          await loadRequests();
        } finally {
          refresh.disabled = false;
        }
      }
    );
  }

  async function init() {
    bindListEvents();
    bindFilters();

    await loadSummary();
    await loadRequests();
  }

  window.ResgataSolicitacoesPage = {
    load: loadRequests,
    loadSummary,
    open: loadDetail,
    refresh: async () => {
      await loadSummary();
      await loadRequests();
    }
  };

  document.addEventListener(
    "DOMContentLoaded",
    init
  );
})();

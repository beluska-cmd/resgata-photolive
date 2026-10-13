const API = "";

let admin = null;
let dashboardData = null;

const pageInfo = {
  dashboard: ["Dashboard", "Visão geral da Central Resgata+"],
  users: ["Usuários", "Contas e utilização da plataforma"],
  devices: ["Dispositivos", "Dispositivos conectados ao Resgata+"],
  services: ["Serviços", "Serviços disponibilizados pela Central"],
  requests: ["Solicitações", "Pedidos de serviços dos usuários"],
  tickets: ["Atendimento", "Tickets e suporte especializado"],
  updates: ["Atualizações", "Versões e atualizações do Resgata+"],
  plans: ["Planos", "Estrutura de planos e recursos"],
  security: ["Segurança", "Sessões e eventos de segurança"],
  reports: ["Relatórios", "Indicadores operacionais"],
  logs: ["Logs", "Auditoria da plataforma"],
  settings: ["Configurações", "Configurações da Central"]
};

const content = document.getElementById("content");
const pageTitle = document.getElementById("pageTitle");
const pageSubtitle = document.getElementById("pageSubtitle");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.style.display = "block";

  setTimeout(() => {
    toast.style.display = "none";
  }, 2500);
}

async function api(path, options = {}) {
  const token = localStorage.getItem("resgata_admin_token");

  const headers = {
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers
  });

  const text = await response.text();

  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      ok: false,
      error: "Resposta inválida do servidor."
    };
  }

  if (response.status === 401) {
    localStorage.removeItem("resgata_admin_token");
    window.location.href = "/admin/login.html";
    throw new Error("Sessão expirada.");
  }

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

async function loadAdmin() {
  const result = await api("/api/admin/me");
  admin = result.admin;

  document.getElementById("adminName").textContent =
    admin.name || "Administrador";

  document.getElementById("adminRole").textContent =
    admin.role || "admin";
}

function metricCard(icon, label, value) {
  return `
    <div class="card">
      <div class="metric">
        <div>
          <span class="metric-label">${escapeHtml(label)}</span>
          <strong class="metric-value">${escapeHtml(value)}</strong>
        </div>
        <div class="metric-icon">${icon}</div>
      </div>
    </div>
  `;
}

async function renderDashboard() {
  const result = await api("/api/admin/dashboard");
  dashboardData = result.dashboard;

  const d = dashboardData;

  content.innerHTML = `
    <div class="cards">
      ${metricCard("👤", "Usuários", d.users.total)}
      ${metricCard("📱", "Dispositivos", d.devices.total)}
      ${metricCard("🧩", "Serviços ativos", d.services.active)}
      ${metricCard("📋", "Solicitações", d.requests.total)}
      ${metricCard("🎧", "Tickets", d.tickets.total)}
      ${metricCard("🔴", "Tickets abertos", d.tickets.open)}
      ${metricCard("🔄", "Atualizações", d.updates.total)}
      ${metricCard("🔔", "Notificações", d.notifications.total)}
    </div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel-head">
          <h2>Atividade recente</h2>
          <span class="badge">${d.audit.total} eventos</span>
        </div>
        <div class="panel-body">
          ${
            d.audit.recent.length
              ? d.audit.recent.map(log => `
                <div class="log-item">
                  <strong>${escapeHtml(log.action)}</strong>
                  <small>
                    ${escapeHtml(log.entity || "")}
                    ${log.createdAt ? " • " + escapeHtml(log.createdAt) : ""}
                  </small>
                </div>
              `).join("")
              : `<div class="empty">Nenhum evento registrado ainda.</div>`
          }
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <h2>Status da Central</h2>
          <span class="badge success">Online</span>
        </div>
        <div class="panel-body">
          <div class="notice">
            O painel está conectado à API e ao banco SQLite.
            Os indicadores acima são carregados em tempo real.
          </div>

          <br>

          <div class="quick-actions">
            <button class="btn" data-page-action="users">👤 Usuários</button>
            <button class="btn" data-page-action="devices">📱 Dispositivos</button>
            <button class="btn" data-page-action="services">🧩 Serviços</button>
            <button class="btn" data-page-action="tickets">🎧 Atendimento</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.querySelectorAll("[data-page-action]").forEach(button => {
    button.addEventListener("click", () => navigate(button.dataset.pageAction));
  });
}

async function renderUsers() {
  const result = await api("/api/admin/users");
  const users = result.users || [];

  content.innerHTML = `
    <div class="module-header">
      <h2>Usuários</h2>
      <p>${users.length} registro(s) retornado(s) pela plataforma.</p>
    </div>

    <div class="panel">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Plano</th>
              <th>Status</th>
              <th>Cadastro</th>
            </tr>
          </thead>
          <tbody>
            ${
              users.length
                ? users.map(user => `
                  <tr>
                    <td>${escapeHtml(user.name)}</td>
                    <td>${escapeHtml(user.email)}</td>
                    <td>${escapeHtml(user.plan || "free")}</td>
                    <td>
                      <span class="badge ${user.status === "active" ? "success" : "warning"}">
                        ${escapeHtml(user.status)}
                      </span>
                    </td>
                    <td>${escapeHtml(user.createdAt || user.created_at || "-")}</td>
                  </tr>
                `).join("")
                : `<tr><td colspan="5" class="empty">Nenhum usuário encontrado.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function renderDevices() {
  const result = await api("/api/admin/devices");
  const devices = result.devices || [];

  content.innerHTML = `
    <div class="module-header">
      <h2>Dispositivos</h2>
      <p>Dispositivos registrados no Resgata+.</p>
    </div>

    <div class="panel">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Dispositivo</th>
              <th>Usuário</th>
              <th>Modelo</th>
              <th>Android</th>
              <th>App</th>
              <th>Status</th>
              <th>Último acesso</th>
            </tr>
          </thead>
          <tbody>
            ${
              devices.length
                ? devices.map(device => `
                  <tr>
                    <td>${escapeHtml(device.name || device.deviceId)}</td>
                    <td>${escapeHtml(device.userName || device.userEmail || "-")}</td>
                    <td>${escapeHtml(device.model || "-")}</td>
                    <td>${escapeHtml(device.androidVersion || "-")}</td>
                    <td>${escapeHtml(device.appVersion || "-")}</td>
                    <td><span class="badge success">${escapeHtml(device.status || "active")}</span></td>
                    <td>${escapeHtml(device.lastSeen || "-")}</td>
                  </tr>
                `).join("")
                : `<tr><td colspan="7" class="empty">Nenhum dispositivo registrado ainda.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function renderServices() {
  const result = await api("/api/admin/services");
  const services = result.services || [];

  content.innerHTML = `
    <div class="module-header">
      <h2>Serviços</h2>
      <p>Controle dos serviços disponibilizados pela Central.</p>
    </div>

    <div class="section-grid">
      ${
        services.map(service => `
          <div class="card">
            <div class="metric">
              <div>
                <span class="metric-label">${escapeHtml(service.category || "Serviço")}</span>
                <strong style="display:block;margin-top:7px">${escapeHtml(service.name)}</strong>
              </div>
              <div class="metric-icon">🧩</div>
            </div>

            <p style="color:var(--muted);line-height:1.5">
              ${escapeHtml(service.description)}
            </p>

            <span class="badge ${service.enabled ? "success" : "danger"}">
              ${service.enabled ? "Ativo" : "Desativado"}
            </span>
          </div>
        `).join("")
      }
    </div>
  `;
}

async function renderTickets() {
  const result = await api("/api/admin/tickets");
  const tickets = result.tickets || [];

  content.innerHTML = `
    <div class="module-header">
      <h2>Atendimento</h2>
      <p>Solicitações de suporte e atendimento especializado.</p>
    </div>

    <div class="panel">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Assunto</th>
              <th>Status</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            ${
              tickets.length
                ? tickets.map(ticket => `
                  <tr>
                    <td>${escapeHtml(ticket.userName || ticket.userEmail || "-")}</td>
                    <td>${escapeHtml(ticket.subject || ticket.title || "-")}</td>
                    <td><span class="badge">${escapeHtml(ticket.status || "-")}</span></td>
                    <td>${escapeHtml(ticket.createdAt || ticket.created_at || "-")}</td>
                  </tr>
                `).join("")
                : `<tr><td colspan="4" class="empty">Nenhum atendimento registrado.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function renderRequests() {
  content.innerHTML = `
    <div class="module-header">
      <h2>Solicitações</h2>
      <p>Centralização dos pedidos realizados pelos usuários.</p>
    </div>

    <div class="panel">
      <div class="panel-body">
        <div class="notice">
          O banco já possui a estrutura de solicitações.
          A próxima etapa desta tela será conectar filtros, detalhes,
          atendimento e alteração de status diretamente à API.
        </div>
      </div>
    </div>
  `;
}

function renderStaticModule(page) {
  const modules = {
    updates: {
      icon: "🔄",
      title: "Atualizações",
      text: "Área preparada para gerenciamento de versões, novidades, manutenção e disponibilidade do aplicativo."
    },
    plans: {
      icon: "💳",
      title: "Planos",
      text: "Área preparada para gratuito, premium, recursos e assinaturas."
    },
    security: {
      icon: "🛡️",
      title: "Segurança",
      text: "Área preparada para sessões administrativas, bloqueios, alertas e eventos de segurança."
    },
    reports: {
      icon: "📊",
      title: "Relatórios",
      text: "Área preparada para indicadores de usuários, serviços, recuperação, suporte e utilização."
    },
    logs: {
      icon: "📝",
      title: "Logs",
      text: "A auditoria já está registrada no banco. Esta tela será ligada aos filtros e consulta dos eventos."
    },
    settings: {
      icon: "⚙️",
      title: "Configurações",
      text: "Área preparada para configurações da Central, serviços, notificações e sistema."
    }
  };

  const module = modules[page];

  content.innerHTML = `
    <div class="module-header">
      <h2>${module.icon} ${module.title}</h2>
      <p>${module.text}</p>
    </div>

    <div class="panel">
      <div class="panel-body">
        <div class="notice">
          Estrutura visual criada e integrada ao Admin Resgata+.
          Os recursos específicos desta área serão conectados aos endpoints
          correspondentes sem substituir os dados reais existentes.
        </div>
      </div>
    </div>
  `;
}

async function navigate(page) {
  if (!pageInfo[page]) page = "dashboard";

  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.page === page);
  });

  pageTitle.textContent = pageInfo[page][0];
  pageSubtitle.textContent = pageInfo[page][1];

  try {
    if (page === "dashboard") await renderDashboard();
    else if (page === "users") await renderUsers();
    else if (page === "devices") await renderDevices();
    else if (page === "services") await renderServices();
    else if (page === "tickets") await renderTickets();
    else if (page === "requests") await renderRequests();
    else renderStaticModule(page);
  } catch (error) {
    content.innerHTML = `
      <div class="panel">
        <div class="panel-body">
          <div class="notice">
            Não foi possível carregar esta área.
            <br><br>
            <strong>${escapeHtml(error.message)}</strong>
          </div>
        </div>
      </div>
    `;
  }
}

async function logout() {
  try {
    await api("/api/admin/logout", {
      method: "POST"
    });
  } catch {
    // A sessão pode já ter expirado.
  }

  localStorage.removeItem("resgata_admin_token");
  window.location.href = "/admin/login.html";
}

document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", () => navigate(item.dataset.page));
});

document.getElementById("refreshButton").addEventListener("click", async () => {
  await navigate(document.querySelector(".nav-item.active")?.dataset.page || "dashboard");
  showToast("Dados atualizados.");
});

document.getElementById("logoutButton").addEventListener("click", logout);

(async function init() {
  const token = localStorage.getItem("resgata_admin_token");

  if (!token) {
    window.location.href = "/admin/login.html";
    return;
  }

  try {
    await loadAdmin();
    await navigate("dashboard");
  } catch (error) {
    console.error(error);
    localStorage.removeItem("resgata_admin_token");
    window.location.href = "/admin/login.html";
  }
})();

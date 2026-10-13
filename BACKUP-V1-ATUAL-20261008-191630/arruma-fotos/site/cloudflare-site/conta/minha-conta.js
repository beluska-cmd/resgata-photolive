(() => {
  const cfg = window.PHOTOLIVE_SUPABASE || {};
  const API = (window.PHOTOLIVE_PAYMENT_API || "").replace(/\/$/, "");

  const $ = (id) => document.getElementById(id);

  const services = {
    "editor-fotos": {
      name: "Editor de Fotos",
      icon: "📸",
      url: "../servicos/editor-fotos/contratar.html"
    },
    "editor-pro": {
      name: "Editor Pro",
      icon: "✨",
      url: "../servicos/editor-pro/index.html"
    },
    "editor-videos": {
      name: "Editor de Vídeos",
      icon: "🎬",
      url: "../servicos/editor-videos/contratar.html"
    },
    "recuperar": {
      name: "Recuperar",
      icon: "🛟",
      url: "../servicos/recuperador-fotos/contratar.html"
    },
    "diagnostico": {
      name: "Diagnóstico",
      icon: "🔎",
      url: "../servicos/diagnostico/contratar.html"
    },
    "pacote-essencial": {
      name: "Pacote Essencial",
      icon: "✨",
      url: "../servicos/pacotes/essencial/index.html"
    },
    "pacote-completo": {
      name: "Pacote Completo",
      icon: "🚀",
      url: "../servicos/pacotes/completo/index.html"
    },
    "premium": {
      name: "Premium",
      icon: "💎",
      url: "../servicos/pacotes/premium/index.html"
    }
  };

  const planLabels = {
    AVULSO: "Avulso",
    MONTHLY: "Mensal",
    YEARLY: "Anual"
  };

  const statusLabels = {
    PENDING: "Aguardando pagamento",
    PAID: "Pago",
    ERROR: "Erro",
    CANCELED: "Cancelado",
    EXPIRED: "Expirado"
  };

  let lastSession = null;

  function money(cents) {
    return (
      "R$ " +
      (Number(cents || 0) / 100)
        .toFixed(2)
        .replace(".", ",")
    );
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function serviceInfo(slug) {
    return (
      services[slug] || {
        name: slug || "Serviço",
        icon: "📦",
        url: "../servicos.html"
      }
    );
  }

  function planLabel(plan) {
    return planLabels[plan] || plan || "—";
  }

  function orderStatus(status) {
    return statusLabels[status] || status || "—";
  }

  function formatDate(value, withTime = false) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleDateString(
      "pt-BR",
      withTime
        ? {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          }
        : {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
          }
    );
  }

  function setStats(entitlements, orders) {
    const active = entitlements.length;
    const total = orders.length;
    const paid = orders.filter(
      (order) => order?.status === "PAID"
    ).length;

    if ($("activeServicesCount")) {
      $("activeServicesCount").textContent = String(active);
    }

    if ($("ordersCount")) {
      $("ordersCount").textContent = String(total);
    }

    if ($("paidOrdersCount")) {
      $("paidOrdersCount").textContent = String(paid);
    }
  }

  function setLoading() {
    if ($("entitlements")) {
      $("entitlements").innerHTML = `
        <div style="padding:18px 0;">
          <p class="muted">Consultando seus serviços...</p>
        </div>
      `;
    }

    if ($("orders")) {
      $("orders").innerHTML = `
        <div style="padding:18px 0;">
          <p class="muted">Consultando seus pedidos...</p>
        </div>
      `;
    }
  }

  function setError(message) {
    if ($("entitlements")) {
      $("entitlements").innerHTML = `
        <div style="padding:18px 0;">
          <strong>Não foi possível carregar seus serviços.</strong>
          <p class="muted">
            ${escapeHtml(message)}
          </p>
        </div>
      `;
    }

    if ($("orders")) {
      $("orders").innerHTML = `
        <div style="padding:18px 0;">
          <strong>Não foi possível carregar seus pedidos.</strong>
          <p class="muted">
            Tente atualizar a página em alguns instantes.
          </p>
        </div>
      `;
    }

    if ($("activeServicesCount")) {
      $("activeServicesCount").textContent = "—";
    }

    if ($("ordersCount")) {
      $("ordersCount").textContent = "—";
    }

    if ($("paidOrdersCount")) {
      $("paidOrdersCount").textContent = "—";
    }
  }

  function renderEntitlements(items) {
    if (!items.length) {
      $("entitlements").innerHTML = `
        <div style="padding:20px 0;">
          <div style="font-size:28px;margin-bottom:8px;">✨</div>
          <strong>Você ainda não possui serviços ativos.</strong>
          <p class="muted">
            Escolha um serviço ou pacote para começar a usar o PhotoLive Magic.
          </p>
          <a class="primary-btn" href="../servicos.html">
            Conhecer serviços
          </a>
        </div>
      `;

      return;
    }

    $("entitlements").innerHTML = items
      .map((item) => {
        const service = serviceInfo(item.product_slug);

        const expiration = item.expires_at
          ? "Válido até " + formatDate(item.expires_at)
          : "Acesso ativo";

        return `
          <div class="account-row">
            <div>
              <strong>
                ${service.icon}
                ${escapeHtml(service.name)}
              </strong>

              <br>

              <small class="muted">
                ${escapeHtml(expiration)}
              </small>
            </div>

            <div class="account-actions">
              <span class="badge active">
                ● Ativo
              </span>

              <a
                class="secondary-btn"
                href="${escapeHtml(service.url)}"
              >
                Usar agora
              </a>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderOrders(items) {
    if (!items.length) {
      $("orders").innerHTML = `
        <div style="padding:20px 0;">
          <div style="font-size:28px;margin-bottom:8px;">🧾</div>
          <strong>Nenhum pedido encontrado.</strong>
          <p class="muted">
            Seus pedidos e pagamentos aparecerão aqui após a contratação.
          </p>
        </div>
      `;

      return;
    }

    $("orders").innerHTML = items
      .map((order) => {
        const service = serviceInfo(order.product_slug);
        const status = order.status || "";
        const badgeClass = status === "PAID" ? "active" : "";

        let action = "";

        if (status === "PENDING") {
          action = `
            <a
              class="secondary-btn"
              href="../pagamentos/pagamento.html?produto=${encodeURIComponent(order.product_slug || "")}&plan=${encodeURIComponent(order.plan_type || "AVULSO")}&pedido=${encodeURIComponent(order.order_nsu || "")}"
            >
              Continuar pagamento
            </a>
          `;
        }

        if (status === "PAID" && order.receipt_url) {
          action = `
            <a
              class="secondary-btn"
              href="${escapeHtml(order.receipt_url)}"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver recibo
            </a>
          `;
        }

        return `
          <div class="account-row">
            <div>
              <strong>
                ${service.icon}
                ${escapeHtml(service.name)}
              </strong>

              <br>

              <small class="muted">
                ${escapeHtml(planLabel(order.plan_type))}
                · ${escapeHtml(formatDate(order.created_at))}
                · ${escapeHtml(money(order.amount_cents))}
              </small>

              ${
                order.paid_at
                  ? `
                    <br>
                    <small class="muted">
                      Pago em ${escapeHtml(formatDate(order.paid_at, true))}
                    </small>
                  `
                  : ""
              }
            </div>

            <div class="account-actions">
              <span class="badge ${badgeClass}">
                ${escapeHtml(orderStatus(status))}
              </span>

              ${action}
            </div>
          </div>
        `;
      })
      .join("");
  }

  async function loadAccount() {
    if (
      !window.supabase ||
      !cfg.url ||
      !cfg.anonKey
    ) {
      setError("A configuração da conta não foi encontrada.");
      return;
    }

    setLoading();

    const client = window.supabase.createClient(
      cfg.url,
      cfg.anonKey
    );

    const {
      data,
      error
    } = await client.auth.getSession();

    if (error || !data?.session) {
      if ($("email")) {
        $("email").textContent =
          "Você precisa entrar na sua conta.";
      }

      if ($("entitlements")) {
        $("entitlements").innerHTML = `
          <p class="muted">
            Faça login para consultar seus serviços.
          </p>
        `;
      }

      if ($("orders")) {
        $("orders").innerHTML = `
          <p class="muted">
            Faça login para consultar seus pedidos.
          </p>
        `;
      }

      return;
    }

    lastSession = data.session;

    if ($("email")) {
      $("email").textContent =
        data.session.user?.email ||
        "Conta conectada";
    }

    if (!API) {
      setError("A API de pagamentos ainda não está configurada.");
      return;
    }

    try {
      const response = await fetch(
        API + "/orders/me",
        {
          method: "GET",
          headers: {
            Authorization:
              "Bearer " + data.session.access_token
          }
        }
      );

      const body = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          body.message ||
          body.code ||
          "Não foi possível consultar a conta."
        );
      }

      const entitlements =
        Array.isArray(body.entitlements)
          ? body.entitlements
          : [];

      const orders =
        Array.isArray(body.orders)
          ? body.orders
          : [];

      setStats(entitlements, orders);
      renderEntitlements(entitlements);
      renderOrders(orders);

    } catch (error) {
      console.error(
        "PhotoLive Magic — erro ao carregar Minha Conta:",
        error
      );

      setError(
        error?.message ||
        "Tente novamente em alguns instantes."
      );
    }
  }

  function setupNavigation() {
    document
      .querySelectorAll("[data-service]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const service = button.dataset.service;

          if (!service) return;

          document
            .querySelectorAll("[data-service]")
            .forEach((item) => {
              item.classList.remove("active");
            });

          button.classList.add("active");

          document
            .querySelectorAll("[data-panel]")
            .forEach((panel) => {
              panel.classList.toggle(
                "active",
                panel.dataset.panel === service
              );
            });
        });
      });
  }

  const refreshButton = $("refreshAccountBtn");

  if (refreshButton) {
    refreshButton.addEventListener("click", async () => {
      refreshButton.disabled = true;
      refreshButton.textContent = "Atualizando...";

      try {
        await loadAccount();
      } finally {
        refreshButton.disabled = false;
        refreshButton.textContent = "↻ Atualizar";
      }
    });
  }

  setupNavigation();
  loadAccount();
})();

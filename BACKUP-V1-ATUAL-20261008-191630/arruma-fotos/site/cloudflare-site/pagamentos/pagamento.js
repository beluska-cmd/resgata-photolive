(() => {
  const cfg = window.PHOTOLIVE_SUPABASE || {};
  const API = (window.PHOTOLIVE_PAYMENT_API || "").replace(/\/$/, "");

  const catalog = {
    "editor-fotos": {
      name: "Editor de Fotos",
      desc: "Ajuste brilho, contraste, saturação, corte, rotação e personalize suas fotos.",
      prices: { AVULSO: 590, MONTHLY: 990, YEARLY: 9900 }
    },
    "editor-pro": {
      name: "Editor Pro",
      desc: "Edição avançada de fotos com exposição, temperatura, sombras, realces, nitidez e filtros profissionais.",
      prices: { AVULSO: 1490, MONTHLY: 1990, YEARLY: 19900 }
    },
    "editor-videos": {
      name: "Editor de Vídeos",
      desc: "Corte, ajuste, gire, silencie e personalize seus vídeos.",
      prices: { AVULSO: 790, MONTHLY: 1290, YEARLY: 12900 }
    },
    "recuperar": {
      name: "Recuperar",
      desc: "Analise locais e arquivos compatíveis em busca de arquivos que possam ser recuperados.",
      prices: { AVULSO: 1490, MONTHLY: 1990, YEARLY: 19900 }
    },
    "diagnostico": {
      name: "Diagnóstico",
      desc: "Analise fotos, vídeos e arquivos para encontrar possíveis problemas, duplicadas e arquivos grandes.",
      prices: { AVULSO: 590, MONTHLY: 790, YEARLY: 7900 }
    },
    "pacote-essencial": {
      name: "Pacote Essencial",
      desc: "Editor de Fotos + Diagnóstico.",
      prices: { AVULSO: 1290, MONTHLY: 1490, YEARLY: 14900 }
    },
    "pacote-completo": {
      name: "Pacote Completo",
      desc: "Fotos + Vídeos + Recuperar + Diagnóstico.",
      prices: { AVULSO: 2490, MONTHLY: 2990, YEARLY: 29900 }
    },
    "premium": {
      name: "Premium",
      desc: "Experiência completa com os recursos Premium disponíveis.",
      prices: { AVULSO: 3490, MONTHLY: 3490, YEARLY: 34900 }
    }
  };

  const params = new URLSearchParams(location.search);

  const slug =
    params.get("product_slug") ||
    params.get("produto") ||
    "editor-fotos";

  const product = catalog[slug];

  const $ = (id) => document.getElementById(id);

  if (!product) {
    if ($("productName")) {
      $("productName").textContent = "Serviço não encontrado";
    }

    if ($("productDesc")) {
      $("productDesc").textContent =
        "O serviço solicitado não está disponível.";
    }

    if ($("payBtn")) {
      $("payBtn").disabled = true;
    }

    return;
  }

  $("productName").textContent = product.name;
  $("productDesc").textContent = product.desc;

  function money(cents) {
    return "R$ " + (cents / 100).toFixed(2).replace(".", ",");
  }

  function update() {
    const selected = document.querySelector(
      'input[name="plan"]:checked'
    );

    if (!selected) return;

    const plan = selected.value;

    $("total").textContent = money(product.prices[plan]);

    document.querySelectorAll(".pay-option").forEach((option) => {
      const input = option.querySelector("input");

      option.classList.toggle(
        "selected",
        Boolean(input && input.checked)
      );
    });

    const label = {
      AVULSO: "Pagamento único",
      MONTHLY: "Cobrança mensal",
      YEARLY: "Cobrança anual"
    }[plan];

    const message = $("planDescription");

    if (message) {
      message.textContent = label || "";
    }
  }

  document
    .querySelectorAll('input[name="plan"]')
    .forEach((input) => {
      input.addEventListener("change", update);
    });

  update();

  function msg(text, type = "") {
    const el = $("message");

    if (!el) return;

    el.textContent = text;
    el.className = "pay-message " + type;
  }

  async function getSession() {
    if (
      !window.supabase ||
      !cfg.url ||
      !cfg.anonKey
    ) {
      return null;
    }

    try {
      const client = window.supabase.createClient(
        cfg.url,
        cfg.anonKey,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        }
      );

      const result = await client.auth.getSession();

      if (result.error) {
        console.error("PhotoLive Magic — erro ao recuperar sessão:", result.error);
        return null;
      }

      return result.data?.session || null;
    } catch (error) {
      console.error("PhotoLive Magic — erro ao inicializar sessão:", error);
      return null;
    }
  }


  async function getOrders(session) {
    if (!API || !session?.access_token) {
      throw new Error(
        "Sessão ou API de pagamentos indisponível."
      );
    }

    const response = await fetch(
      API + "/orders/me",
      {
        method: "GET",
        headers: {
          "Authorization":
            "Bearer " + session.access_token
        }
      }
    );

    const data = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.message ||
        data.code ||
        "Não foi possível verificar o pedido."
      );
    }

    return data;
  }

  function getReturnOrderNsu() {
    return params.get("order_nsu");
  }

  function isPaymentReturn() {
    return params.get("status") === "return";
  }

  function showPostPayment(show = true) {
    const box = $("postPaymentResult");

    if (!box) return;

    box.classList.toggle(
      "hidden",
      !show
    );
  }

  function setPostPayment(title, text, type = "") {
    showPostPayment(true);

    const titleEl =
      $("postPaymentTitle");

    const textEl =
      $("postPaymentText");

    if (titleEl) {
      titleEl.textContent = title;
    }

    if (textEl) {
      textEl.textContent = text;
    }

    if (type === "error") {
      msg(text, "error");
    } else if (type === "ok") {
      msg(text, "ok");
    }
  }

  async function waitForPaidOrder(session, orderNsu) {
    const maxAttempts = 12;
    const delayMs = 5000;

    for (
      let attempt = 1;
      attempt <= maxAttempts;
      attempt++
    ) {
      const data =
        await getOrders(session);

      const orders =
        Array.isArray(data?.orders)
          ? data.orders
          : [];

      const order =
        orders.find(
          (item) =>
            String(item?.order_nsu || "") ===
            String(orderNsu || "")
        );

      if (order?.status === "PAID") {
        return order;
      }

      if (
        order &&
        String(order.product_slug || "") !==
          String(slug || "")
      ) {
        throw new Error(
          "O pedido retornado não corresponde ao serviço solicitado."
        );
      }

      if (attempt < maxAttempts) {
        const seconds =
          Math.ceil(delayMs / 1000);

        setPostPayment(
          "Aguardando confirmação",
          "Seu pagamento foi recebido pelo checkout. Estamos aguardando a confirmação definitiva do pedido. Nova verificação em " +
            seconds +
            " segundos."
        );

        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              delayMs
            )
        );
      }
    }

    return null;
  }

  async function processConfirmedPhoto(order) {
    if (
      !window.PhotoLiveProcessing ||
      typeof window.PhotoLiveProcessing.processPendingPhoto !==
        "function"
    ) {
      throw new Error(
        "O módulo de processamento da foto não foi carregado."
      );
    }

    setPostPayment(
      "Pagamento confirmado",
      "Pagamento confirmado. Agora vamos aplicar as melhorias identificadas no diagnóstico."
    );

    const processed =
      await window.PhotoLiveProcessing.processPendingPhoto();

    const imageEl =
      $("postPaymentImage");

    const preview =
      $("postPaymentPreview");

    const downloadButton =
      $("downloadImprovedBtn");

    if (!imageEl || !preview || !downloadButton) {
      throw new Error(
        "A área de resultado da foto não está disponível."
      );
    }

    const url =
      URL.createObjectURL(
        processed.result.blob
      );

    imageEl.src = url;

    preview.classList.remove("hidden");
    downloadButton.classList.remove("hidden");

    downloadButton.onclick = () => {
      const pendingName =
        processed.originalFile?.name ||
        "foto";

      window.PhotoLiveProcessing.createDownload(
        processed.result,
        pendingName.replace(/\.[^.]+$/, "")
      );
    };

    const adjustment =
      processed.result.adjustments || {};

    const changes = [];

    if (adjustment.brightness) {
      changes.push(
        "iluminação " +
          (adjustment.brightness > 0
            ? "aumentada"
            : "reduzida")
      );
    }

    if (adjustment.contrast) {
      changes.push(
        "contraste ajustado"
      );
    }

    const description =
      changes.length
        ? "A foto foi processada com " +
          changes.join(" e ") +
          ". O original foi preservado."
        : "A foto foi processada conforme o diagnóstico. O original foi preservado.";

    setPostPayment(
      "✨ Foto melhorada",
      description,
      "ok"
    );

    return processed;
  }

  async function handlePaymentReturn() {
    if (!isPaymentReturn()) {
      return;
    }

    const button = $("payBtn");

    if (button) {
      button.disabled = true;
      button.textContent =
        "Verificando pagamento...";
    }

    document
      .querySelectorAll('input[name="plan"]')
      .forEach((input) => {
        input.disabled = true;
      });

    const orderNsu =
      getReturnOrderNsu();

    if (!orderNsu) {
      setPostPayment(
        "Pedido não identificado",
        "Não recebemos o identificador do pedido no retorno do pagamento. O serviço não foi liberado.",
        "error"
      );

      return;
    }

    try {
      const session =
        await getSession();

      if (!session?.access_token) {
        setPostPayment(
          "Sessão necessária",
          "Entre novamente na sua conta para verificar a confirmação do pagamento.",
          "error"
        );

        return;
      }

      setPostPayment(
        "Verificando pagamento",
        "Estamos consultando a confirmação oficial do seu pedido."
      );

      const order =
        await waitForPaidOrder(
          session,
          orderNsu
        );

      if (!order) {
        setPostPayment(
          "Pagamento ainda não confirmado",
          "O checkout retornou, mas o backend ainda não confirmou o pagamento. O serviço continua bloqueado por segurança. Você pode aguardar alguns instantes e atualizar esta página.",
          "error"
        );

        return;
      }

      if (
        String(order.product_slug || "") !==
        String(slug || "")
      ) {
        setPostPayment(
          "Pedido incompatível",
          "O pedido confirmado não corresponde ao serviço solicitado. O processamento foi bloqueado por segurança.",
          "error"
        );

        return;
      }

      await processConfirmedPhoto(
        order
      );

      if (button) {
        button.classList.add("hidden");
      }
    } catch (error) {
      console.error(
        "PhotoLive Magic — erro no pós-pagamento:",
        error
      );

      setPostPayment(
        "Não foi possível concluir o processamento",
        error.message ||
          "O pagamento pode ter sido confirmado, mas não foi possível preparar a foto neste momento.",
        "error"
      );
    }
  }

  $("payBtn").addEventListener("click", async () => {
    const session = await getSession();

    if (!session?.access_token) {
      msg(
        "Entre na sua conta PhotoLive Magic antes de continuar.",
        "error"
      );

      setTimeout(() => {
        location.href =
          "../index.html?openLogin=1&returnTo=" +
          encodeURIComponent(location.href);
      }, 1200);

      return;
    }

    if (!API) {
      msg(
        "A API de pagamentos ainda não está configurada.",
        "error"
      );

      return;
    }

    const selected = document.querySelector(
      'input[name="plan"]:checked'
    );

    const plan = selected?.value;

    if (!plan || !product.prices[plan]) {
      msg(
        "Escolha uma forma de contratação.",
        "error"
      );

      return;
    }

    const button = $("payBtn");

    button.disabled = true;
    button.textContent = "Preparando pagamento...";

    msg("Criando seu pedido...");

    try {
      const response = await fetch(
        API + "/checkout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization":
              "Bearer " + session.access_token
          },
          body: JSON.stringify({
            product_slug: slug,
            plan_type: plan
          })
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (
        !response.ok ||
        !data.checkout_url
      ) {
        throw new Error(
          data.message ||
          data.code ||
          "Não foi possível criar o checkout."
        );
      }

      msg(
        "Checkout criado. Redirecionando...",
        "ok"
      );

      window.location.href =
        data.checkout_url;

    } catch (error) {
      console.error(error);

      msg(
        error.message ||
          "Não foi possível iniciar o pagamento.",
        "error"
      );

      button.disabled = false;
      button.textContent =
        "Continuar para pagamento";
    }
  });

  /*
   * Se esta página foi aberta pelo retorno da InfinitePay,
   * verifica o pedido no backend e somente depois processa
   * a foto pendente.
   */
  handlePaymentReturn();

})();

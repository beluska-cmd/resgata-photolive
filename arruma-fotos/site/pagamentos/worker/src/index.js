const SERVICES = {
  "editor-fotos": {
    name: "Editor de Fotos",
    description: "Ajuste brilho, contraste, saturação, corte e rotação.",
    prices: { AVULSO: 590, MONTHLY: 990, YEARLY: 9900 }
  },
  "editor-pro": {
    name: "Editor Pro",
    description: "Edição avançada de fotos com exposição, temperatura, sombras, realces, nitidez e filtros profissionais.",
    prices: { AVULSO: 1490, MONTHLY: 1990, YEARLY: 19900 }
  },
  "editor-videos": {
    name: "Editor de Vídeos",
    description: "Corte, ajuste, gire, silencie e personalize vídeos.",
    prices: { AVULSO: 790, MONTHLY: 1290, YEARLY: 12900 }
  },
  "recuperar": {
    name: "Recuperar",
    description: "Análise de locais e arquivos compatíveis para recuperação.",
    prices: { AVULSO: 1490, MONTHLY: 1990, YEARLY: 19900 }
  },
  "diagnostico": {
    name: "Diagnóstico",
    description: "Analise fotos, vídeos e arquivos para encontrar problemas.",
    prices: { AVULSO: 590, MONTHLY: 790, YEARLY: 7900 }
  },
  "pacote-essencial": {
    name: "Pacote Essencial",
    description: "Editor de Fotos + Diagnóstico.",
    prices: { AVULSO: 1290, MONTHLY: 1490, YEARLY: 14900 }
  },
  "pacote-completo": {
    name: "Pacote Completo",
    description: "Fotos + Vídeos + Recuperar + Diagnóstico.",
    prices: { AVULSO: 2490, MONTHLY: 2990, YEARLY: 29900 }
  },
  "premium": {
    name: "Premium",
    description: "Experiência completa com os recursos Premium disponíveis.",
    prices: { AVULSO: 3490, MONTHLY: 3490, YEARLY: 34900 }
  }
};

const PLAN_LABELS = { AVULSO: "Avulso", MONTHLY: "Mensal", YEARLY: "Anual" };

function cors(env) {
  return env.ALLOWED_ORIGIN || "*";
}

function json(data, status = 200, env = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": cors(env),
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    }
  });
}

async function currentUser(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ") || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: auth
    }
  });
  if (!response.ok) return null;
  return await response.json().catch(() => null);
}

function newId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function appOrigin(request, env) {
  return env.APP_ORIGIN || new URL(request.url).origin;
}

async function createInfinitePayLink(order, service, plan, user, request, env) {
  if (!env.INFINITEPAY_HANDLE) throw new Error("INFINITEPAY_NOT_CONFIGURED");

  const origin = appOrigin(request, env);
  const payload = {
    handle: env.INFINITEPAY_HANDLE,
    order_nsu: order.order_nsu,
    redirect_url: `${origin}/pagamento.html?status=return&order_nsu=${encodeURIComponent(order.order_nsu)}`,
    webhook_url: `${env.WEBHOOK_URL || origin + "/webhook/infinitepay"}`,
    customer: {
      email: user.email || undefined
    },
    items: [{
      quantity: 1,
      price: service.prices[plan],
      description: `${service.name} — ${PLAN_LABELS[plan]}`
    }]
  };

  const response = await fetch("https://api.checkout.infinitepay.io/links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.url) {
    throw new Error(data?.message || "INFINITEPAY_CHECKOUT_FAILED");
  }
  return data;
}

async function activateOrder(env, order, payload) {
  const now = new Date().toISOString();
  const paidCents = Number(payload.paid_amount ?? payload.amount ?? 0);

  await env.DB.prepare(`
    UPDATE orders
    SET status='PAID',
        invoice_slug=?,
        transaction_nsu=?,
        receipt_url=?,
        capture_method=?,
        paid_amount_cents=?,
        paid_at=?,
        updated_at=?
    WHERE id=? AND status!='PAID'
  `).bind(
    payload.invoice_slug || null,
    payload.transaction_nsu || null,
    payload.receipt_url || null,
    payload.capture_method || null,
    paidCents || null,
    now,
    now,
    order.id
  ).run();

  const fresh = await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(order.id).first();
  if (!fresh || fresh.status !== "PAID") return;

  let expires = null;
  if (fresh.plan_type === "MONTHLY") {
    const d = new Date(); d.setMonth(d.getMonth() + 1); expires = d.toISOString();
  } else if (fresh.plan_type === "YEARLY") {
    const d = new Date(); d.setFullYear(d.getFullYear() + 1); expires = d.toISOString();
  }

  await env.DB.prepare(`
    INSERT OR IGNORE INTO entitlements
      (id,user_id,product_slug,order_id,status,starts_at,expires_at,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).bind(
    newId("ent"),
    fresh.user_id,
    fresh.product_slug,
    fresh.id,
    "ACTIVE",
    fresh.paid_at || now,
    expires,
    now,
    now
  ).run();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": cors(env),
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
        }
      });
    }

    if (url.pathname === "/health") {
      return json({ ok: true, service: "photolive-infinitepay" }, 200, env);
    }

    if (url.pathname === "/catalog" && request.method === "GET") {
      return json({
        ok: true,
        services: Object.fromEntries(Object.entries(SERVICES).map(([slug, s]) => [
          slug, { ...s, plan_labels: PLAN_LABELS }
        ]))
      }, 200, env);
    }

    if (url.pathname === "/checkout" && request.method === "POST") {
      const user = await currentUser(request, env);
      if (!user?.id) return json({ ok:false, code:"AUTH_REQUIRED", message:"Faça login para continuar." }, 401, env);

      const body = await request.json().catch(() => null);
      const service = SERVICES[body?.product_slug];
      const plan = body?.plan_type;

      if (!service || !PLAN_LABELS[plan]) {
        return json({ ok:false, code:"INVALID_PRODUCT", message:"Produto ou plano inválido." }, 400, env);
      }

      const amount = service.prices[plan];
      const orderId = newId("ord");
      const orderNsu = orderId;
      const now = new Date().toISOString();

      await env.DB.prepare(`
        INSERT INTO orders
          (id,user_id,user_email,product_slug,product_name,plan_type,amount_cents,status,order_nsu,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        orderId, user.id, user.email || null, body.product_slug, service.name,
        plan, amount, "PENDING", orderNsu, now, now
      ).run();

      try {
        const checkout = await createInfinitePayLink(
          { id: orderId, order_nsu: orderNsu },
          service, plan, user, request, env
        );
        return json({
          ok: true,
          order_id: orderId,
          order_nsu: orderNsu,
          checkout_url: checkout.url
        }, 200, env);
      } catch (error) {
        await env.DB.prepare("UPDATE orders SET status='ERROR', updated_at=? WHERE id=?")
          .bind(new Date().toISOString(), orderId).run();
        return json({ ok:false, code:"CHECKOUT_FAILED", message:String(error.message || error) }, 502, env);
      }
    }

    if (url.pathname === "/webhook/infinitepay" && request.method === "POST") {
      const payload = await request.json().catch(() => null);
      if (!payload?.order_nsu) return json({ success:false, message:"order_nsu ausente" }, 400, env);

      const order = await env.DB.prepare("SELECT * FROM orders WHERE order_nsu=?")
        .bind(payload.order_nsu).first();

      if (!order) return json({ success:false, message:"Pedido não encontrado" }, 400, env);

      const expected = Number(order.amount_cents);
      const received = Number(payload.amount ?? 0);
      if (received && received !== expected) {
        return json({ success:false, message:"Valor do pedido não confere" }, 400, env);
      }

      await activateOrder(env, order, payload);
      return json({ success:true, message:null }, 200, env);
    }

    if (url.pathname === "/orders/me" && request.method === "GET") {
      const user = await currentUser(request, env);
      if (!user?.id) return json({ ok:false, code:"AUTH_REQUIRED" }, 401, env);

      const result = await env.DB.prepare(`
        SELECT id, product_slug, product_name, plan_type, amount_cents, status,
               order_nsu, transaction_nsu, receipt_url, created_at, paid_at
        FROM orders WHERE user_id=? ORDER BY created_at DESC
      `).bind(user.id).all();

      const active = await env.DB.prepare(`
        SELECT product_slug, status, starts_at, expires_at
        FROM entitlements
        WHERE user_id=? AND status='ACTIVE'
        ORDER BY created_at DESC
      `).bind(user.id).all();

      return json({ ok:true, orders:result.results || [], entitlements:active.results || [] }, 200, env);
    }

    return json({ ok:false, code:"NOT_FOUND" }, 404, env);
  }
};

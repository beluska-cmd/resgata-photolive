
/* =========================================================
   PHOTOLIVE PRO — CONTROLE DE ACESSO
   Login + contratação ativa
   ========================================================= */

const PhotoLiveProAccess = {
  apiBase: "https://photolive-infinitepay.analisyone.workers.dev",
  productSlug: "editor-pro",

  async check() {
    const config = window.PHOTOLIVE_SUPABASE;

    if (!config?.url || !config?.anonKey) {
      return { ok: false, reason: "CONFIG" };
    }

    if (!window.supabase) {
      return { ok: false, reason: "SUPABASE" };
    }

    const client = window.supabase.createClient(
      config.url,
      config.anonKey
    );

    const { data: { session } } = await client.auth.getSession();

    if (!session?.access_token) {
      return { ok: false, reason: "LOGIN" };
    }

    const response = await fetch(`${this.apiBase}/orders/me`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    if (!response.ok) {
      return { ok: false, reason: "API" };
    }

    const data = await response.json();

    const active = Array.isArray(data.entitlements) &&
      data.entitlements.some(item =>
        item.product_slug === this.productSlug &&
        item.status === "ACTIVE"
      );

    return {
      ok: active,
      reason: active ? "AUTHORIZED" : "NOT_PURCHASED"
    };
  }
};

function showProAccessScreen(reason) {
  const root = document.body;

  root.innerHTML = `
    <main style="
      min-height:100vh;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:32px;
      box-sizing:border-box;
      background:
        radial-gradient(circle at top, rgba(80,120,255,.16), transparent 45%),
        #07111f;
      color:#fff;
      font-family:Arial,sans-serif;
    ">
      <section style="
        width:min(560px,100%);
        padding:38px;
        border:1px solid rgba(255,255,255,.12);
        border-radius:24px;
        background:rgba(255,255,255,.06);
        box-shadow:0 20px 70px rgba(0,0,0,.35);
        text-align:center;
      ">
        <div style="font-size:48px;margin-bottom:16px;">✦</div>

        <div style="
          display:inline-block;
          padding:6px 12px;
          border-radius:999px;
          background:rgba(130,100,255,.18);
          color:#c9bcff;
          font-size:12px;
          font-weight:700;
          letter-spacing:1px;
        ">EDITOR PRO</div>

        <h1 style="margin:18px 0 12px;font-size:30px;">
          Edição avançada de fotos
        </h1>

        <p style="
          margin:0 auto 26px;
          max-width:440px;
          color:#b9c4d5;
          line-height:1.6;
        ">
          O Editor Pro está disponível para clientes com uma
          contratação ativa. Tenha acesso a exposição,
          temperatura, sombras, realces, nitidez e filtros profissionais.
        </p>

        <div style="
          display:flex;
          gap:12px;
          justify-content:center;
          flex-wrap:wrap;
        ">
          <a href="../../pagamentos/pagamento.html?produto=editor-pro" style="
            display:inline-flex;
            align-items:center;
            justify-content:center;
            padding:14px 22px;
            border-radius:12px;
            background:#fff;
            color:#07111f;
            text-decoration:none;
            font-weight:700;
          ">
            Conhecer planos do Pro
          </a>

          <a href="../../conta/minha-conta.html" style="
            display:inline-flex;
            align-items:center;
            justify-content:center;
            padding:14px 22px;
            border-radius:12px;
            background:rgba(255,255,255,.08);
            color:#fff;
            text-decoration:none;
            font-weight:700;
          ">
            Minha conta
          </a>
        </div>
      </section>
    </main>
  `;
}

async function protectEditorPro() {
  try {
    const result = await PhotoLiveProAccess.check();

    if (result.ok) {
      window.__PHOTOLIVE_PRO_AUTHORIZED__ = true;
      return;
    }

    if (result.reason === "LOGIN") {
      const returnTo =
        window.location.pathname +
        window.location.search +
        window.location.hash;

      try {
        sessionStorage.setItem(
          "photolive_return_to",
          returnTo
        );
      } catch (_) {}

      window.location.href = "../../conta/minha-conta.html";
      return;
    }

    showProAccessScreen(result.reason);
  } catch (error) {
    console.error("Falha na verificação do Editor Pro:", error);
    showProAccessScreen("API");
  }
}

protectEditorPro();


(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const state = {
    image: null,
    sourceUrl: "",
    rotation: 0,
    flipH: false,
    flipV: false,
    filter: "original",
    adjustments: {
      exposure: 0,
      temperature: 0,
      shadows: 0,
      highlights: 0,
      sharpness: 0
    },
    history: [],
    historyIndex: -1,
    showingBefore: false
  };

  const canvas = $("proCanvas");
  const ctx = canvas.getContext("2d");

  function snapshot() {
    return JSON.stringify({
      rotation: state.rotation,
      flipH: state.flipH,
      flipV: state.flipV,
      filter: state.filter,
      adjustments: { ...state.adjustments }
    });
  }

  function restoreSnapshot(value) {
    const data = JSON.parse(value);

    state.rotation = data.rotation;
    state.flipH = data.flipH;
    state.flipV = data.flipV;
    state.filter = data.filter;
    state.adjustments = { ...data.adjustments };

    updateControls();
    draw();
  }

  function pushHistory() {
    const value = snapshot();

    if (state.history[state.historyIndex] === value) return;

    state.history =
      state.history.slice(0, state.historyIndex + 1);

    state.history.push(value);
    state.historyIndex = state.history.length - 1;
  }

  function undo() {
    if (state.historyIndex <= 0) return;

    state.historyIndex--;
    restoreSnapshot(state.history[state.historyIndex]);
  }

  function redo() {
    if (state.historyIndex >= state.history.length - 1) return;

    state.historyIndex++;
    restoreSnapshot(state.history[state.historyIndex]);
  }

  function getFilterString() {
    const a = state.adjustments;

    let brightness = 100 + a.exposure + a.shadows * 0.25;
    let contrast = 100 + a.highlights * 0.35;
    let saturate = 100;

    let filter = [
      `brightness(${brightness}%)`,
      `contrast(${contrast}%)`,
      `saturate(${saturate}%)`
    ];

    if (a.temperature > 0) {
      filter.push(`sepia(${a.temperature * 0.22}%)`);
    } else if (a.temperature < 0) {
      filter.push(`hue-rotate(${Math.abs(a.temperature) * 0.8}deg)`);
    }

    switch (state.filter) {
      case "warm":
        filter.push("sepia(18%) saturate(118%)");
        break;
      case "cool":
        filter.push("hue-rotate(12deg) saturate(108%)");
        break;
      case "vintage":
        filter.push("sepia(35%) contrast(92%) saturate(82%)");
        break;
      case "mono":
        filter.push("grayscale(100%)");
        break;
      case "dramatic":
        filter.push("contrast(125%) saturate(115%)");
        break;
    }

    return filter.join(" ");
  }

  function draw() {
    if (!state.image || state.showingBefore) {
      drawImage(false);
      return;
    }

    drawImage(true);
  }

  function drawImage(processed) {
    const image = state.image;

    if (!image) return;

    const angle = ((state.rotation % 360) + 360) % 360;
    const rotated = angle === 90 || angle === 270;

    canvas.width = rotated ? image.naturalHeight : image.naturalWidth;
    canvas.height = rotated ? image.naturalWidth : image.naturalHeight;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(angle * Math.PI / 180);
    ctx.scale(
      state.flipH ? -1 : 1,
      state.flipV ? -1 : 1
    );

    if (processed) {
      ctx.filter = getFilterString();
    } else {
      ctx.filter = "none";
    }

    ctx.drawImage(
      image,
      -image.naturalWidth / 2,
      -image.naturalHeight / 2
    );

    ctx.restore();
  }

  function updateControls() {
    Object.entries(state.adjustments).forEach(([key, value]) => {
      const input = $(key);
      const output = $(`${key}Value`);

      if (input) input.value = value;
      if (output) output.textContent = value;
    });

    document.querySelectorAll(".filter-btn").forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.filter === state.filter
      );
    });
  }

  function reset() {
    state.rotation = 0;
    state.flipH = false;
    state.flipV = false;
    state.filter = "original";

    state.adjustments = {
      exposure: 0,
      temperature: 0,
      shadows: 0,
      highlights: 0,
      sharpness: 0
    };

    pushHistory();
    updateControls();
    draw();
  }

  function saveCopy() {
    if (!state.image) return;

    state.showingBefore = false;
    draw();

    canvas.toBlob((blob) => {
      if (!blob) {
        alert("Não foi possível criar a foto editada.");
        return;
      }

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "foto-editada-photolive-magic-pro.jpg";

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    }, "image/jpeg", 0.95);
  }

  $("proFileInput").addEventListener("change", (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Escolha uma imagem válida.");
      return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      state.image = image;
      state.sourceUrl = url;
      state.rotation = 0;
      state.flipH = false;
      state.flipV = false;
      state.filter = "original";
      state.adjustments = {
        exposure: 0,
        temperature: 0,
        shadows: 0,
        highlights: 0,
        sharpness: 0
      };

      state.history = [];
      state.historyIndex = -1;

      $("uploadCard").hidden = true;
      $("editorLayout").hidden = false;
      $("imageInfo").textContent =
        `${file.name} · ${image.naturalWidth} × ${image.naturalHeight}`;

      updateControls();
      draw();
      pushHistory();
    };

    image.src = url;
  });

  ["exposure", "temperature", "shadows", "highlights", "sharpness"]
    .forEach((key) => {
      $(key).addEventListener("input", (event) => {
        state.adjustments[key] = Number(event.target.value);
        $(`${key}Value`).textContent = event.target.value;
        draw();
      });

      $(key).addEventListener("change", () => {
        pushHistory();
      });
    });

  document.querySelectorAll(".filter-btn").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      pushHistory();
      updateControls();
      draw();
    });
  });

  $("undoBtn").addEventListener("click", undo);
  $("redoBtn").addEventListener("click", redo);
  $("resetBtn").addEventListener("click", reset);

  $("rotateLeftBtn").addEventListener("click", () => {
    state.rotation -= 90;
    pushHistory();
    draw();
  });

  $("rotateRightBtn").addEventListener("click", () => {
    state.rotation += 90;
    pushHistory();
    draw();
  });

  $("flipHBtn").addEventListener("click", () => {
    state.flipH = !state.flipH;
    pushHistory();
    draw();
  });

  $("flipVBtn").addEventListener("click", () => {
    state.flipV = !state.flipV;
    pushHistory();
    draw();
  });

  $("beforeBtn").addEventListener("mousedown", () => {
    state.showingBefore = true;
    draw();
  });

  $("beforeBtn").addEventListener("mouseup", () => {
    state.showingBefore = false;
    draw();
  });

  $("beforeBtn").addEventListener("mouseleave", () => {
    state.showingBefore = false;
    draw();
  });

  $("beforeBtn").addEventListener("touchstart", () => {
    state.showingBefore = true;
    draw();
  }, { passive: true });

  $("beforeBtn").addEventListener("touchend", () => {
    state.showingBefore = false;
    draw();
  }, { passive: true });

  $("saveBtn").addEventListener("click", saveCopy);
})();

const state = {
  items: [],
  selected: new Set(),
  filter: "all",
  sort: "newest",
  editor: null
};

const $ = (id) => document.getElementById(id);

const fileInput = $("fileInput");
const openFilesBtn = $("openFilesBtn");
const emptyChooseBtn = $("emptyChooseBtn");
const mediaGrid = $("mediaGrid");
const emptyState = $("emptyState");
const stats = $("stats");
const selectionInfo = $("selectionInfo");
const importantNotice = $("importantNotice");

const previewModal = $("previewModal");
const previewContent = $("previewContent");

const editorModal = $("editorModal");
const editorCanvas = $("editorCanvas");
const editorCtx = editorCanvas
  ? editorCanvas.getContext("2d")
  : null;

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  return `${(bytes / Math.pow(1024, index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function isScreenshotName(name) {
  const value = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "");

  return [
    "screenshot",
    "screen shot",
    "screen_shot",
    "screen-",
    "screen_",
    "captura",
    "captura de tela",
    "captura_de_tela",
    "scr_",
    "printscreen",
    "print_screen"
  ].some((term) => value.includes(term));
}

function looksLikeScreenshotDimensions(width, height, mimeType = "") {
  const w = Math.max(width, height);
  const h = Math.min(width, height);

  if (!w || !h) return false;

  const ratio = w / h;

  // Dimensões muito comuns de telas de celulares.
  const commonSizes = [
    [720, 1280],
    [720, 1440],
    [1080, 1920],
    [1080, 2160],
    [1080, 2280],
    [1080, 2340],
    [1080, 2400],
    [1080, 2412],
    [1080, 2460],
    [1170, 2532],
    [1179, 2556],
    [1284, 2778],
    [1440, 2560],
    [1440, 2880],
    [1440, 3200]
  ];

  const commonSize = commonSizes.some(([cw, ch]) => {
    return (
      (w === cw && h === ch) ||
      (w === ch && h === cw)
    );
  });

  if (commonSize) return true;

  // Capturas normalmente são verticais, grandes e em formatos
  // comuns de imagem. Esta regra é deliberadamente conservadora.
  const portraitMobile =
    ratio >= 1.65 &&
    h >= 650 &&
    w >= 1000 &&
    w <= 1600;

  const supportedFormat =
    !mimeType ||
    /image\\/(jpeg|jpg|png|webp)/i.test(mimeType);

  return portraitMobile && supportedFormat;
}

function classifyByName(name) {
  const value = name.toLowerCase();

  if (
    value.includes("comprovante") ||
    value.includes("pagamento") ||
    value.includes("pix") ||
    value.includes("boleto") ||
    value.includes("receipt")
  ) {
    return "receipt";
  }

  if (
    value.includes("documento") ||
    value.includes("doc_") ||
    value.includes("rg") ||
    value.includes("cpf") ||
    value.includes("contrato") ||
    value.includes("nota")
  ) {
    return "document";
  }

  if (
    value.includes("agenda") ||
    value.includes("consulta") ||
    value.includes("agendamento") ||
    value.includes("appointment")
  ) {
    return "appointment";
  }

  if (
    value.includes("conversa") ||
    value.includes("chat") ||
    value.includes("whatsapp") ||
    value.includes("telegram")
  ) {
    return "conversation";
  }

  return null;
}

function classifyItem(item) {
  if (item.type === "video") {
    return {
      screenshot: false,
      category: null,
      important: false
    };
  }

  const screenshotByName = isScreenshotName(item.name);
  const screenshotByDimensions = looksLikeScreenshotDimensions(
    item.width,
    item.height,
    item.file?.type || ""
  );

  const screenshot = screenshotByName || screenshotByDimensions;
  const category = classifyByName(item.name);

  return {
    screenshot,
    category,
    important: Boolean(category) || screenshot,
    screenshotSource: screenshotByName
      ? "name"
      : screenshotByDimensions
        ? "dimensions"
        : null
  };
}

function createItem(file) {
  const type = file.type.startsWith("video/") ? "video" : "photo";

  const item = {
    id: crypto.randomUUID(),
    file,
    name: file.name,
    size: file.size,
    type,
    modified: new Date(file.lastModified || Date.now()),
    url: URL.createObjectURL(file),
    width: 0,
    height: 0,
    classification: null
  };

  item.classification = classifyItem(item);

  return item;
}

async function readDimensions(item) {
  if (item.type !== "photo") return;

  return new Promise((resolve) => {
    const image = new Image();

    image.onload = () => {
      item.width = image.naturalWidth || image.width || 0;
      item.height = image.naturalHeight || image.height || 0;

      item.classification = classifyItem(item);

      resolve();
    };

    image.onerror = () => {
      console.warn(
        "PHOTO LIVE: não foi possível analisar dimensões:",
        item.name
      );

      item.classification = classifyItem(item);
      resolve();
    };

    image.src = item.url;
  });
}

async function addFiles(files) {
  const newItems = Array.from(files)
    .filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"))
    .map(createItem);

  if (!newItems.length) return;

  await Promise.all(newItems.map(readDimensions));

  state.items.push(...newItems);
  render();
}

function getVisibleItems() {
  let result = [...state.items];

  if (state.filter === "photo") {
    result = result.filter((item) => item.type === "photo" && !item.classification.screenshot);
  }

  if (state.filter === "video") {
    result = result.filter((item) => item.type === "video");
  }

  if (state.filter === "screenshot") {
    result = result.filter((item) => item.classification.screenshot);
  }

  if (state.filter === "important") {
    result = result.filter((item) => item.classification.important);
  }

  if (["document", "receipt", "appointment", "conversation"].includes(state.filter)) {
    result = result.filter((item) => item.classification.category === state.filter);
  }

  result.sort((a, b) => {
    if (state.sort === "newest") return b.modified - a.modified;
    if (state.sort === "oldest") return a.modified - b.modified;
    if (state.sort === "name") return a.name.localeCompare(b.name, "pt-BR");
    if (state.sort === "size") return b.size - a.size;
    return 0;
  });

  return result;
}

function renderStats() {
  const photos = state.items.filter(
    (item) => item.type === "photo" && !item.classification?.screenshot
  ).length;

  const videos = state.items.filter(
    (item) => item.type === "video"
  ).length;

  const screenshots = state.items.filter(
    (item) => item.type === "photo" && item.classification?.screenshot
  ).length;

  const important = state.items.filter(
    (item) => item.classification?.important
  ).length;

  stats.innerHTML = `
    <div class="stat"><strong>${state.items.length}</strong><span>Total</span></div>
    <div class="stat"><strong>${photos}</strong><span>Fotos</span></div>
    <div class="stat"><strong>${videos}</strong><span>Vídeos</span></div>
    <div class="stat"><strong>${screenshots}</strong><span>Capturas</span></div>
    <div class="stat"><strong>${important}</strong><span>Pode ser importante</span></div>
  `;
}

function renderSelection() {
  const count = state.selected.size;

  selectionInfo.textContent = count
    ? `${count} arquivo(s) selecionado(s)`
    : "Nenhum arquivo selecionado";
}

function renderImportantNotice() {
  const candidates = state.items.filter(
    (item) => item.classification.important
  );

  if (!candidates.length) {
    importantNotice.classList.add("hidden");
    importantNotice.innerHTML = "";
    return;
  }

  const names = candidates
    .slice(0, 3)
    .map((item) => item.name)
    .join(", ");

  importantNotice.classList.remove("hidden");
  importantNotice.innerHTML = `
    <div class="notice-icon">💡</div>
    <div>
      <strong>Encontramos algo que pode ser importante</strong>
      <p>
        ${candidates.length} arquivo(s) receberam uma sugestão.
        ${escapeHtml(names)}
      </p>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function categoryLabel(item) {
  if (item.classification.category === "receipt") return "💳 Comprovante";
  if (item.classification.category === "document") return "🧾 Documento";
  if (item.classification.category === "appointment") return "📅 Compromisso";
  if (item.classification.category === "conversation") return "💬 Conversa";
  if (item.classification.screenshot) return "📱 Captura de tela";
  return "";
}

function render() {
  renderStats();
  renderSelection();
  renderImportantNotice();

  const visible = getVisibleItems();

  emptyState.classList.toggle("hidden", state.items.length > 0);
  mediaGrid.innerHTML = "";

  if (state.items.length && !visible.length) {
    mediaGrid.innerHTML = `
      <div class="no-results">
        <div>🔎</div>
        <h3>Nada encontrado nesta categoria</h3>
        <p>Tente outro filtro.</p>
      </div>
    `;
    return;
  }

  visible.forEach((item) => {
    const card = document.createElement("article");
    card.className = "media-card";

    const selected = state.selected.has(item.id);
    const label = categoryLabel(item);

    const diagnosticInfo =
      item.type === "photo" && item.width && item.height
        ? `<small class="diagnostic-size">📐 ${item.width} × ${item.height}</small>`
        : "";

    card.innerHTML = `
      <div class="media-preview">
        ${
          item.type === "photo"
            ? `
              <img
                class="media-thumb"
                src="${item.url}"
                alt="${escapeHtml(item.name)}"
              >
            `
            : `
              <video
                src="${item.url}"
                muted
                preload="metadata"
              ></video>

              <span class="video-badge">▶ Vídeo</span>
            `
        }

        <label class="select-check">
          <input type="checkbox" ${selected ? "checked" : ""}>
          <span></span>
        </label>

        ${label ? `<span class="category-badge">${label}</span>` : ""}
      </div>

      <div class="media-info">
        <strong title="${escapeHtml(item.name)}">
          ${escapeHtml(item.name)}
        </strong>

        <span>
          ${formatBytes(item.size)} · ${formatDate(item.modified)}
        </span>

        ${diagnosticInfo}
      </div>

      <div class="card-actions">
        <button class="card-btn preview-btn">👁 Ver</button>
        <button class="card-btn magic-card-btn">✨ Editar</button>
      </div>
    `;

    mediaGrid.appendChild(card);

    const checkbox = card.querySelector("input");

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        state.selected.add(item.id);
      } else {
        state.selected.delete(item.id);
      }

      renderSelection();
    });

    card.querySelector(".preview-btn").addEventListener("click", () => {
      openPreview(item);
    });

    const editButton = card.querySelector(".magic-card-btn");

    if (editButton) {
      editButton.addEventListener("click", () => {
        if (item.type === "photo") {
          openEditor(item);
        } else if (item.type === "video") {
          openVideoEditor(item);
        }
      });
    }
  });
}

function openPreview(item) {
  previewContent.innerHTML = `
    <div class="preview-title">
      <strong>${escapeHtml(item.name)}</strong>
      <span>${formatBytes(item.size)}</span>
    </div>

    ${
      item.type === "photo"
        ? `<img class="large-preview" src="${item.url}" alt="${escapeHtml(item.name)}">`
        : `<video class="large-preview" src="${item.url}" controls autoplay></video>`
    }

    ${
      item.type === "photo"
        ? `<button class="primary-btn preview-edit-btn">✨ Editar foto</button>`
        : ""
    }
  `;

  previewModal.classList.remove("hidden");

  const edit = previewContent.querySelector(".preview-edit-btn");
  if (edit) {
    edit.addEventListener("click", () => {
      closePreview();
      openEditor(item);
    });
  }
}

function closePreview() {
  previewModal.classList.add("hidden");
  previewContent.innerHTML = "";
}

function selectAllVisible() {
  getVisibleItems().forEach((item) => state.selected.add(item.id));
  render();
}

function clearSelection() {
  state.selected.clear();
  render();
}

function downloadSelected() {
  const selected = state.items.filter((item) => state.selected.has(item.id));

  if (!selected.length) {
    alert("Selecione pelo menos um arquivo.");
    return;
  }

  selected.forEach((item, index) => {
    setTimeout(() => {
      const link = document.createElement("a");
      link.href = item.url;
      link.download = item.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }, index * 150);
  });
}

/* =========================================================
   PHOTOLIVE MAGIC — EDITOR DE VÍDEO V1.3
   Processamento de prévia local.
   O vídeo original nunca é alterado.
   ========================================================= */

const videoEditorState = {
  item: null,
  objectUrl: null,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  rotation: 0,
  start: 0,
  end: 0,
  muted: false,

  text: "",
  textX: 0.5,
  textY: 0.85,
  textSize: 48,
  textFont: "Arial",
  textBold: true,
  textItalic: false,
  textAlign: "center",
  textColor: "#ffffff",
  textBackground: "#000000",
  textBackgroundOpacity: 0.55,
  textShadow: true,
  textOutline: false,
  textOutlineColor: "#000000",
  textOutlineWidth: 3,
  textRotation: 0
};

function formatVideoTime(seconds) {
  if (!Number.isFinite(seconds)) return "00:00";

  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;

  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function getVideoFilter() {
  const brightness = 100 + videoEditorState.brightness;
  const contrast = 100 + videoEditorState.contrast;
  const saturation = 100 + videoEditorState.saturation;

  return `
    brightness(${brightness}%)
    contrast(${contrast}%)
    saturate(${saturation}%)
  `;
}

function updateVideoEditorPreview() {
  const video = document.getElementById("videoEditorPlayer");

  if (!video) return;

  video.style.filter = getVideoFilter();

  video.style.transform =
    `rotate(${videoEditorState.rotation}deg)`;

  video.style.transformOrigin = "center center";
}

function updateVideoEditorControls() {
  const brightness = document.getElementById("videoBrightnessRange");
  const contrast = document.getElementById("videoContrastRange");
  const saturation = document.getElementById("videoSaturationRange");

  if (brightness) {
    brightness.value = videoEditorState.brightness;
    document.getElementById("videoBrightnessValue").textContent =
      videoEditorState.brightness;
  }

  if (contrast) {
    contrast.value = videoEditorState.contrast;
    document.getElementById("videoContrastValue").textContent =
      videoEditorState.contrast;
  }

  if (saturation) {
    saturation.value = videoEditorState.saturation;
    document.getElementById("videoSaturationValue").textContent =
      videoEditorState.saturation;
  }

  const start = document.getElementById("videoStartValue");
  const end = document.getElementById("videoEndValue");

  if (start) {
    start.textContent = formatVideoTime(videoEditorState.start);
  }

  if (end) {
    end.textContent = formatVideoTime(videoEditorState.end);
  }

  const muteBtn = document.getElementById("videoMuteBtn");

  if (muteBtn) {
    muteBtn.textContent = videoEditorState.muted
      ? "🔇 Sem áudio"
      : "🔊 Manter áudio";
  }
}

function openVideoEditor(item) {
  if (!item || item.type !== "video") return;

  if (!(item.file instanceof Blob)) {
    alert("O arquivo original deste vídeo não está disponível.");
    return;
  }

  closeVideoEditor();

  videoEditorState.item = item;
  videoEditorState.brightness = 0;
  videoEditorState.contrast = 0;
  videoEditorState.saturation = 0;
  videoEditorState.rotation = 0;
  videoEditorState.start = 0;
  videoEditorState.end = 0;
  videoEditorState.muted = false;

  const modal = document.getElementById("videoEditorModal");
  const video = document.getElementById("videoEditorPlayer");

  if (!modal || !video) return;

  videoEditorState.objectUrl = URL.createObjectURL(item.file);

  video.src = videoEditorState.objectUrl;
  video.load();

  document.getElementById("videoEditorFileName").textContent =
    item.name;

  modal.classList.remove("hidden");

  video.addEventListener("loadedmetadata", handleVideoMetadata, {
    once: true
  });

  updateVideoEditorControls();
  updateVideoEditorPreview();
}

function handleVideoMetadata() {
  const video = document.getElementById("videoEditorPlayer");

  if (!video) return;

  videoEditorState.start = 0;
  videoEditorState.end = Number.isFinite(video.duration)
    ? video.duration
    : 0;

  const startRange = document.getElementById("videoStartRange");
  const endRange = document.getElementById("videoEndRange");

  if (startRange) {
    startRange.min = 0;
    startRange.max = video.duration;
    startRange.step = 0.01;
    startRange.value = 0;
  }

  if (endRange) {
    endRange.min = 0;
    endRange.max = video.duration;
    endRange.step = 0.01;
    endRange.value = video.duration;
  }

  updateVideoEditorControls();

  document.getElementById("videoSmartMessage").textContent =
    `Vídeo de ${formatVideoTime(video.duration)}. ` +
    "Você pode ajustar a imagem e escolher o trecho que deseja manter.";
}

function closeVideoEditor() {
  const modal = document.getElementById("videoEditorModal");
  const video = document.getElementById("videoEditorPlayer");

  if (video) {
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.style.filter = "";
    video.style.transform = "";
  }

  if (videoEditorState.objectUrl) {
    URL.revokeObjectURL(videoEditorState.objectUrl);
  }

  videoEditorState.objectUrl = null;
  videoEditorState.item = null;

  if (modal) {
    modal.classList.add("hidden");
  }
}

function analyzeVideo() {
  if (!videoEditorState.item) return;

  const video = document.getElementById("videoEditorPlayer");
  const message = document.getElementById("videoSmartMessage");

  if (!video || !message) return;

  /*
   * Primeira camada inteligente:
   * usamos informações disponíveis localmente e sugerimos
   * uma melhoria conservadora, sem enviar o vídeo para servidor.
   */
  const duration = video.duration;

  if (!Number.isFinite(duration) || duration <= 0) {
    message.textContent =
      "Ainda estou carregando o vídeo. Tente analisar novamente.";
    return;
  }

  message.textContent =
    "✨ O vídeo está pronto para uma melhoria leve. " +
    "Ajuste automático sugerido: brilho +5, contraste +10 e saturação +6.";

  videoEditorState.brightness = 5;
  videoEditorState.contrast = 10;
  videoEditorState.saturation = 6;

  updateVideoEditorControls();
  updateVideoEditorPreview();
}

function improveVideo() {
  if (!videoEditorState.item) return;

  videoEditorState.brightness = 5;
  videoEditorState.contrast = 10;
  videoEditorState.saturation = 6;

  const message = document.getElementById("videoSmartMessage");

  if (message) {
    message.textContent =
      "✨ Melhoria aplicada na prévia. " +
      "O vídeo original continua intacto.";
  }

  updateVideoEditorControls();
  updateVideoEditorPreview();
}

function rotateVideo(direction) {
  videoEditorState.rotation =
    (videoEditorState.rotation + direction * 90 + 360) % 360;

  updateVideoEditorPreview();
}

function toggleVideoMute() {
  const video = document.getElementById("videoEditorPlayer");

  if (!video) return;

  videoEditorState.muted = !videoEditorState.muted;
  video.muted = videoEditorState.muted;

  updateVideoEditorControls();
}

function setupVideoEditor() {
  const closeBtn =
    document.getElementById("closeVideoEditorBtn");

  const modal =
    document.getElementById("videoEditorModal");

  const video =
    document.getElementById("videoEditorPlayer");

  if (!closeBtn || !modal || !video) return;

  closeBtn.addEventListener("click", closeVideoEditor);

  const backdrop = modal.querySelector(".modal-backdrop");

  if (backdrop) {
    backdrop.addEventListener("click", closeVideoEditor);
  }

  document
    .getElementById("analyzeVideoBtn")
    ?.addEventListener("click", analyzeVideo);

  document
    .getElementById("improveVideoBtn")
    ?.addEventListener("click", improveVideo);

  document
    .getElementById("videoRotateLeftBtn")
    ?.addEventListener("click", () => rotateVideo(-1));

  document
    .getElementById("videoRotateRightBtn")
    ?.addEventListener("click", () => rotateVideo(1));

  document
    .getElementById("videoMuteBtn")
    ?.addEventListener("click", toggleVideoMute);

  document
    .getElementById("videoBrightnessRange")
    ?.addEventListener("input", (event) => {
      videoEditorState.brightness =
        Number(event.target.value);

      document.getElementById("videoBrightnessValue")
        .textContent = videoEditorState.brightness;

      updateVideoEditorPreview();
    });

  document
    .getElementById("videoContrastRange")
    ?.addEventListener("input", (event) => {
      videoEditorState.contrast =
        Number(event.target.value);

      document.getElementById("videoContrastValue")
        .textContent = videoEditorState.contrast;

      updateVideoEditorPreview();
    });

  document
    .getElementById("videoSaturationRange")
    ?.addEventListener("input", (event) => {
      videoEditorState.saturation =
        Number(event.target.value);

      document.getElementById("videoSaturationValue")
        .textContent = videoEditorState.saturation;

      updateVideoEditorPreview();
    });

  document
    .getElementById("videoStartRange")
    ?.addEventListener("input", (event) => {
      const video = document.getElementById("videoEditorPlayer");

      let value = Number(event.target.value);

      if (value >= videoEditorState.end) {
        value = Math.max(0, videoEditorState.end - 0.1);
      }

      videoEditorState.start = value;

      if (video && video.currentTime < value) {
        video.currentTime = value;
      }

      updateVideoEditorControls();
    });

  document
    .getElementById("videoEndRange")
    ?.addEventListener("input", (event) => {
      const video = document.getElementById("videoEditorPlayer");

      let value = Number(event.target.value);

      if (value <= videoEditorState.start) {
        value = Math.min(
          video.duration,
          videoEditorState.start + 0.1
        );
      }

      videoEditorState.end = value;

      if (video && video.currentTime > value) {
        video.currentTime = value;
      }

      updateVideoEditorControls();
    });

  video.addEventListener("timeupdate", () => {
    if (
      videoEditorState.end > 0 &&
      video.currentTime >= videoEditorState.end
    ) {
      video.currentTime = videoEditorState.start;
      video.pause();
    }
  });
}

/*
 * Procura os cartões de vídeo e adiciona o botão Editar.
 * Não altera o editor de fotos.
 */
function enableVideoEditButtons() {
  document.querySelectorAll("[data-video-edit]").forEach((button) => {
    if (button.dataset.videoEditorReady === "1") return;

    button.dataset.videoEditorReady = "1";

    button.addEventListener("click", () => {
      const index = Number(button.dataset.videoEdit);

      if (
        Number.isInteger(index) &&
        state.items &&
        state.items[index]
      ) {
        openVideoEditor(state.items[index]);
      }
    });
  });
}

/* ============================================================
   PHOTOLIVE — CONTROLE DO MENU EXPANSÍVEL
   ============================================================ */

function initPhotoLiveExpandableMenu() {
  const buttons = document.querySelectorAll(
    ".photolive-side-toggle[data-menu-target]"
  );

  if (!buttons.length) return;

  buttons.forEach((button) => {
    if (button.dataset.photoliveMenuReady === "1") return;

    button.dataset.photoliveMenuReady = "1";

    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();

      const targetId = this.getAttribute("aria-controls");
      const target = document.getElementById(targetId);

      if (!target) return;

      const isOpen =
        this.getAttribute("aria-expanded") === "true";

      buttons.forEach((otherButton) => {
        const otherId = otherButton.getAttribute("aria-controls");
        const otherTarget = document.getElementById(otherId);
        const otherArrow = otherButton.querySelector(
          ".photolive-side-arrow"
        );

        otherButton.setAttribute("aria-expanded", "false");

        if (otherTarget) {
          otherTarget.hidden = true;
        }

        if (otherArrow) {
          otherArrow.textContent = "›";
        }
      });

      if (!isOpen) {
        this.setAttribute("aria-expanded", "true");
        target.hidden = false;

        const arrow = this.querySelector(
          ".photolive-side-arrow"
        );

        if (arrow) {
          arrow.textContent = "⌄";
        }
      }
    });
  });
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initPhotoLiveExpandableMenu,
    { once: true }
  );
} else {
  initPhotoLiveExpandableMenu();
}



/* ============================================================
   PHOTOLIVE — ÁREA DINÂMICA DA HOME
   ============================================================ */

function initPhotoLiveHomeWorkspace() {
  const welcome = document.getElementById("photoliveHomeWelcome");
  const diagnostic = document.getElementById("diagnostico-gratuito");
  const packages = document.getElementById("photoliveHomePackages");
  const fotos = document.getElementById("photoliveHomeFotos");
  const videos = document.getElementById("photoliveHomeVideos");
  const service = document.getElementById("photoliveHomeService");

  const packageDetails = document.getElementById("photolivePackageDetails");
  const fotosDetails = document.getElementById("photoliveFotosDetails");
  const videosDetails = document.getElementById("photoliveVideosDetails");
  const serviceDetails = document.getElementById("photoliveServiceDetails");

  if (
    !welcome ||
    !diagnostic ||
    !packages ||
    !fotos ||
    !videos ||
    !service
  ) return;

  const views = [
    welcome,
    diagnostic,
    packages,
    fotos,
    videos,
    service
  ];

  function showView(view) {
    views.forEach((item) => {
      item.classList.toggle("hidden", item !== view);
    });
  }

  const catalog = {
    fotos: {
      label: "📷 FOTOS",
      title: "Ferramentas para suas fotos",
      items: [
        {
          icon: "📸",
          title: "Editor de Fotos",
          text: "Edite suas fotos, melhore a imagem e preserve o arquivo original.",
          details: [
            "Brilho e contraste",
            "Saturação",
            "Melhoria automática",
            "Preservação do original"
          ],
          link: "servicos/editor-fotos/index.html"
        },
        {
          icon: "✨",
          title: "Editor Pro",
          text: "Edição avançada para quem quer mais controle sobre suas imagens.",
          details: [
            "Exposição",
            "Temperatura",
            "Sombras e realces",
            "Filtros profissionais"
          ],
          link: "servicos/editor-pro/index.html"
        },
        {
          icon: "🗂️",
          title: "Organizador",
          text: "Organize seus arquivos de fotos de forma prática.",
          details: [
            "Organização",
            "Separação de arquivos",
            "Categorias",
            "Mais praticidade"
          ],
          link: "servicos/organizador-fotos/index.html"
        },
        {
          icon: "♻️",
          title: "Recuperador",
          text: "Ferramenta para trabalhar com arquivos que precisam de recuperação.",
          details: [
            "Seleção de arquivos",
            "Recuperação",
            "Organização",
            "Preservação"
          ],
          link: "servicos/recuperador-fotos/index.html"
        },
        {
          icon: "🎨",
          title: "Criador de Fotos",
          text: "Crie novas composições e conteúdos visuais.",
          details: [
            "Criação",
            "Composição",
            "Imagens personalizadas",
            "Exportação"
          ],
          link: "servicos/criador-fotos/index.html"
        },
        {
          icon: "🗜️",
          title: "Compressor e Conversor",
          text: "Comprima imagens e trabalhe com diferentes formatos.",
          details: [
            "Compressão",
            "Conversão",
            "Redução de tamanho",
            "Exportação"
          ],
          link: "servicos/compressor-fotos/index.html"
        },
        {
          icon: "📐",
          title: "Redimensionador",
          text: "Ajuste as dimensões das suas imagens.",
          details: [
            "Redimensionamento",
            "Dimensões personalizadas",
            "Preparação para uso",
            "Exportação"
          ],
          link: "servicos/redimensionar-fotos/index.html"
        },
        {
          icon: "🖼️",
          title: "Colagem",
          text: "Monte várias fotos em uma única composição.",
          details: [
            "Várias fotos",
            "Composição",
            "Layout",
            "Exportação"
          ],
          link: "servicos/colagem-fotos/index.html"
        },
        {
          icon: "💧",
          title: "Marca d'água",
          text: "Adicione identificação e proteção visual às suas imagens.",
          details: [
            "Texto",
            "Marca d'água",
            "Posicionamento",
            "Exportação"
          ],
          link: "servicos/marca-dagua-fotos/index.html"
        }
      ]
    },

    videos: {
      label: "🎬 VÍDEOS",
      title: "Ferramentas para seus vídeos",
      items: [
        {
          icon: "🎬",
          title: "Editor de Vídeos",
          text: "Área dedicada para trabalhar com seus vídeos.",
          details: [
            "Edição de vídeos",
            "Ferramentas próprias",
            "Fluxo separado das fotos",
            "Área independente"
          ],
          link: "servicos/editor-videos/index.html"
        }
      ]
    },

    servicos: {
      label: "🔎 SERVIÇOS",
      title: "Serviços PhotoLive Magic",
      items: [
        {
          icon: "🔎",
          title: "Diagnóstico Gratuito",
          text: "Analise uma foto gratuitamente antes de contratar um serviço.",
          details: [
            "Análise inicial",
            "Avaliação da imagem",
            "Recomendações",
            "Teste gratuito"
          ],
          link: "#diagnostico-gratuito",
          action: "diagnostico"
        },
        {
          icon: "♻️",
          title: "Recuperar",
          text: "Serviço voltado para recuperação e tratamento de arquivos.",
          details: [
            "Recuperação",
            "Tratamento de arquivos",
            "Preservação",
            "Acesso mediante contratação"
          ],
          link: "servicos/recuperador-fotos/contratar.html"
        }
      ]
    },

    pacotes: {
      label: "📦 PACOTES",
      title: "Escolha como quer usar o PhotoLive Magic",
      items: [
        {
          icon: "📦",
          title: "Pacote Essencial",
          text: "Recursos essenciais para cuidar dos seus arquivos.",
          details: [
            "Editor de Fotos",
            "Ferramentas essenciais",
            "Organização básica",
            "Acesso aos recursos do pacote"
          ],
          link: "servicos/pacotes/essencial/index.html"
        },
        {
          icon: "🚀",
          title: "Pacote Completo",
          text: "Mais ferramentas para editar, organizar e recuperar.",
          details: [
            "Recursos do Essencial",
            "Editor de Vídeos",
            "Mais ferramentas de fotos",
            "Recursos ampliados"
          ],
          link: "servicos/pacotes/completo/index.html"
        },
        {
          icon: "⭐",
          title: "Premium",
          text: "A experiência mais completa do PhotoLive Magic.",
          details: [
            "Recursos completos da plataforma",
            "Ferramentas avançadas",
            "Editor Pro",
            "Experiência Premium"
          ],
          link: "servicos/pacotes/premium/index.html"
        }
      ]
    }
  };

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function buildSelectedDetail(item) {
    if (!item) return "";

    if (item.action === "diagnostico") {
      return `
        <div class="photolive-home-selected-detail">
          <span class="package-icon">${item.icon}</span>
          <span class="photolive-eyebrow">SELECIONADO</span>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.text)}</p>
          <ul>
            ${item.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}
          </ul>
          <button type="button"
                  class="product-cta photolive-diagnostic-home-cta">
            Fazer diagnóstico gratuito
          </button>
        </div>
      `;
    }

    return `
      <div class="photolive-home-selected-detail">
        <span class="package-icon">${item.icon}</span>
        <span class="photolive-eyebrow">SELECIONADO</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.text)}</p>
        <ul>
          ${item.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}
        </ul>
        <a class="product-cta" href="${item.link}">
          Conhecer ${escapeHtml(item.title)}
        </a>
      </div>
    `;
  }

  function renderCategory(category) {
    const data = catalog[category];

    if (!data) return;

    let targetView = null;
    let targetContainer = null;

    if (category === "fotos") {
      targetView = fotos;
      targetContainer = fotosDetails;
    } else if (category === "videos") {
      targetView = videos;
      targetContainer = videosDetails;
    } else if (category === "servicos") {
      targetView = service;
      targetContainer = serviceDetails;
    } else if (category === "pacotes") {
      targetView = packages;
      targetContainer = packageDetails;
    }

    if (!targetView || !targetContainer) return;

    showView(targetView);

    targetContainer.innerHTML = `
      <div class="photolive-product-detail photolive-category-page">

        <div class="photolive-category-heading">
          <span class="photolive-eyebrow">${data.label}</span>
          <h3>${escapeHtml(data.title)}</h3>
          <p>Conheça os recursos disponíveis para cuidar, organizar e transformar seus arquivos.</p>
        </div>

        <div class="photolive-home-item-grid photolive-informative-grid">
          ${data.items.map((item) => {

            const details = Array.isArray(item.details)
              ? item.details.slice(0, 4)
              : [];

            return `
              <div
                class="photolive-home-item-card photolive-informative-card"
                data-home-category="${escapeHtml(category)}">

                <div class="photolive-informative-icon">
                  ${item.icon || "✨"}
                </div>

                <div class="photolive-informative-body">

                  <h4>${escapeHtml(item.title)}</h4>

                  <p class="photolive-informative-description">
                    ${escapeHtml(item.text)}
                  </p>

                  ${
                    details.length
                      ? `
                        <ul class="photolive-informative-features">
                          ${details.map(
                            (detail) =>
                              `<li>${escapeHtml(detail)}</li>`
                          ).join("")}
                        </ul>
                      `
                      : ""
                  }

                </div>

              </div>
            `;
          }).join("")}
        </div>

      </div>
    `;

    bindDiagnosticButton(targetContainer);
  }

  function bindDiagnosticButton(container) {
    const buttons = container.querySelectorAll(
      '[data-action="diagnostico"]'
    );

    buttons.forEach((button) => {
      if (button.dataset.bound === "1") return;

      button.dataset.bound = "1";

      button.addEventListener("click", () => {
        const target = document.getElementById("diagnostico-gratuito");

        if (!target) return;

        showView(target);

        target.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });
    });
  }

  document
    .querySelectorAll(".photolive-side-toggle[data-menu-target]")
    .forEach((button) => {
      if (button.dataset.photoliveWorkspaceReady === "1") return;

      button.dataset.photoliveWorkspaceReady = "1";

      button.addEventListener("click", () => {
        const category = button.dataset.menuTarget;

        if (catalog[category]) {
          renderCategory(category);
        }
      });
    });

  document
    .querySelectorAll(".photolive-package-card")
    .forEach((card) => {
      card.addEventListener("click", () => {
        const product = card.dataset.homeProduct;

        if (product === "pacote-essencial") {
          renderCategory("pacotes");
        }

        if (product === "pacote-completo") {
          renderCategory("pacotes");
        }

        if (product === "premium") {
          renderCategory("pacotes");
        }
      });
    });

  const diagnosticBtn =
    document.getElementById("openFreeDiagnosticBtn");

  if (diagnosticBtn) {
    diagnosticBtn.addEventListener("click", () => {
      const target = document.getElementById("diagnostico-gratuito");

      if (!target) return;

      showView(target);

      target.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }


}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initPhotoLiveHomeWorkspace,
    { once: true }
  );
} else {
  initPhotoLiveHomeWorkspace();
}

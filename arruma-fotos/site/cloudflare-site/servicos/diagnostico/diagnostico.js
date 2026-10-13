(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const input = $("diagnosticoFileInput");
  const dropzone = $("diagnosticoDropzone");
  const analyzeBtn = $("diagnosticoAnalyzeBtn");
  const clearBtn = $("diagnosticoClearBtn");
  const fileCount = $("diagnosticoFileCount");
  const status = $("diagnosticoStatus");
  const results = $("diagnosticoResults");

  let selectedFiles = [];

  const imageTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/bmp",
    "image/avif"
  ];

  const documentExtensions = [
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".csv",
    ".txt",
    ".zip"
  ];

  function formatBytes(bytes) {
    if (!bytes) return "0 B";

    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1
    );

    return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
  }

  function extensionOf(name) {
    const index = name.lastIndexOf(".");
    return index >= 0 ? name.slice(index).toLowerCase() : "";
  }

  function classifyFile(file) {
    const type = (file.type || "").toLowerCase();
    const extension = extensionOf(file.name);

    if (imageTypes.includes(type) || type.startsWith("image/")) {
      return "image";
    }

    if (type.startsWith("video/")) {
      return "video";
    }

    if (documentExtensions.includes(extension)) {
      return "document";
    }

    return "other";
  }

  function likelyScreenshot(file) {
    const name = file.name.toLowerCase();

    return (
      name.includes("screenshot") ||
      name.includes("captura") ||
      name.includes("screen_shot") ||
      name.includes("screen-shot") ||
      name.includes("captura de tela")
    );
  }

  async function hashFile(file) {
    if (!window.crypto?.subtle) {
      return null;
    }

    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);

    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  async function inspectImage(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        URL.revokeObjectURL(url);

        resolve({
          valid: true,
          width: image.naturalWidth,
          height: image.naturalHeight
        });
      };

      image.onerror = () => {
        URL.revokeObjectURL(url);

        resolve({
          valid: false,
          width: 0,
          height: 0
        });
      };

      image.src = url;
    });
  }

  function setStatus(message, type = "") {
    status.textContent = message;
    status.className = "diagnostico-status";

    if (type) {
      status.classList.add(type);
    }
  }

  function updateSelectionUI() {
    const count = selectedFiles.length;

    fileCount.textContent =
      count === 0
        ? "Nenhum arquivo selecionado."
        : `${count} arquivo${count === 1 ? "" : "s"} selecionado${count === 1 ? "" : "s"}.`;

    analyzeBtn.disabled = count === 0;
    clearBtn.disabled = count === 0;
  }

  function addFiles(files) {
    const incoming = Array.from(files || []);

    const map = new Map(
      selectedFiles.map((file) => [
        `${file.name}|${file.size}|${file.lastModified}`,
        file
      ])
    );

    for (const file of incoming) {
      const key = `${file.name}|${file.size}|${file.lastModified}`;
      map.set(key, file);
    }

    selectedFiles = Array.from(map.values());

    updateSelectionUI();

    if (selectedFiles.length) {
      setStatus(
        "Arquivos prontos. Clique em “Analisar arquivos” para gerar o diagnóstico.",
        "ok"
      );
    }
  }

  function clearSelection() {
    selectedFiles = [];
    input.value = "";
    results.classList.remove("is-visible");

    $("diagnosticoTotal").textContent = "0";
    $("diagnosticoSize").textContent = "0 MB";
    $("diagnosticoDuplicates").textContent = "0";
    $("diagnosticoProblems").textContent = "0";
    $("diagnosticoImages").textContent = "0";
    $("diagnosticoVideos").textContent = "0";
    $("diagnosticoDocuments").textContent = "0";
    $("diagnosticoOther").textContent = "0";
    $("diagnosticoLarge").textContent = "0";
    $("diagnosticoScreenshots").textContent = "0";

    $("diagnosticoFindings").innerHTML = "";

    $("diagnosticoRecommendation").className =
      "diagnostico-status";

    $("diagnosticoRecommendation").textContent =
      "Nenhuma análise executada ainda.";

    updateSelectionUI();

    setStatus("Selecione os arquivos para começar.");
  }

  async function analyze() {
    if (!selectedFiles.length) return;

    analyzeBtn.disabled = true;
    clearBtn.disabled = true;

    results.classList.add("is-visible");

    setStatus(
      "Analisando os arquivos localmente. Nada está sendo apagado ou alterado..."
    );

    try {
      let images = 0;
      let videos = 0;
      let documents = 0;
      let other = 0;
      let large = 0;
      let screenshots = 0;
      let problems = 0;

      let totalSize = 0;

      const hashes = new Map();
      const findings = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const category = classifyFile(file);

        totalSize += file.size;

        if (category === "image") images++;
        else if (category === "video") videos++;
        else if (category === "document") documents++;
        else other++;

        if (file.size >= 100 * 1024 * 1024) {
          large++;
        }

        if (likelyScreenshot(file)) {
          screenshots++;
        }

        setStatus(
          `Analisando ${i + 1} de ${selectedFiles.length}: ${file.name}`
        );

        const hash = await hashFile(file);

        if (hash) {
          if (!hashes.has(hash)) {
            hashes.set(hash, []);
          }

          hashes.get(hash).push(file.name);
        }

        if (category === "image") {
          const info = await inspectImage(file);

          if (!info.valid) {
            problems++;

            findings.push({
              title: file.name,
              detail: "Não foi possível abrir esta imagem no navegador."
            });
          }
        }
      }

      let duplicateFiles = 0;

      for (const [, names] of hashes) {
        if (names.length > 1) {
          duplicateFiles += names.length - 1;

          findings.push({
            title: `Duplicados encontrados: ${names.length}`,
            detail: names.join(", ")
          });
        }
      }

      if (large > 0) {
        findings.push({
          title: `${large} arquivo${large === 1 ? "" : "s"} grande${large === 1 ? "" : "s"}`,
          detail: "Arquivo com 100 MB ou mais."
        });
      }

      if (screenshots > 0) {
        findings.push({
          title: `${screenshots} possível${screenshots === 1 ? "" : "is"} captura${screenshots === 1 ? "" : "s"} de tela`,
          detail: "Identificadas pelo nome do arquivo."
        });
      }

      $("diagnosticoTotal").textContent = selectedFiles.length;
      $("diagnosticoSize").textContent = formatBytes(totalSize);
      $("diagnosticoDuplicates").textContent = duplicateFiles;
      $("diagnosticoProblems").textContent = problems;

      $("diagnosticoImages").textContent = images;
      $("diagnosticoVideos").textContent = videos;
      $("diagnosticoDocuments").textContent = documents;
      $("diagnosticoOther").textContent = other;
      $("diagnosticoLarge").textContent = large;
      $("diagnosticoScreenshots").textContent = screenshots;

      const findingsList = $("diagnosticoFindings");
      findingsList.innerHTML = "";

      if (!findings.length) {
        const item = document.createElement("li");

        item.innerHTML = `
          <span>Nenhum sinal relevante encontrado</span>
          <strong>OK</strong>
        `;

        findingsList.appendChild(item);
      } else {
        for (const finding of findings.slice(0, 50)) {
          const item = document.createElement("li");

          const left = document.createElement("span");
          const right = document.createElement("strong");

          left.textContent = finding.title;
          right.textContent = "Ver";

          item.title = finding.detail;

          item.appendChild(left);
          item.appendChild(right);

          findingsList.appendChild(item);
        }
      }

      const recommendation = $("diagnosticoRecommendation");

      if (problems > 0) {
        recommendation.className = "diagnostico-status warn";

        recommendation.textContent =
          `A análise encontrou ${problems} arquivo${problems === 1 ? "" : "s"} que merece${problems === 1 ? "" : "m"} uma verificação.`;
      } else if (
        duplicateFiles > 0 ||
        large > 0 ||
        screenshots > 0
      ) {
        recommendation.className = "diagnostico-status warn";

        recommendation.textContent =
          "A análise encontrou itens que podem merecer organização. Revise o relatório antes de tomar qualquer decisão.";
      } else {
        recommendation.className = "diagnostico-status ok";

        recommendation.textContent =
          "Nenhum problema evidente foi encontrado nesta análise inicial.";
      }

      setStatus(
        `Diagnóstico concluído. ${selectedFiles.length} arquivo${selectedFiles.length === 1 ? "" : "s"} analisado${selectedFiles.length === 1 ? "" : "s"}.`,
        "ok"
      );

    } catch (error) {
      console.error("[PhotoLive Diagnóstico]", error);

      setStatus(
        "Não foi possível concluir a análise. Tente novamente com uma quantidade menor de arquivos.",
        "error"
      );
    } finally {
      analyzeBtn.disabled = selectedFiles.length === 0;
      clearBtn.disabled = selectedFiles.length === 0;
    }
  }

  input.addEventListener("change", (event) => {
    addFiles(event.target.files);
  });

  analyzeBtn.addEventListener("click", analyze);

  clearBtn.addEventListener("click", clearSelection);

  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragover");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("is-dragover");
  });

  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragover");

    addFiles(event.dataTransfer.files);
  });

  updateSelectionUI();

})();

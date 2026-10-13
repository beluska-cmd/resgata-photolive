(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const fileInput = $("fileInput");
  const editorModal = $("editorModal");
  const editorCanvas = $("editorCanvas");
  const editorCtx = editorCanvas.getContext("2d");

  const state = {
    editor: null
  };

  function editorDefaultState(item) {
    return {
      item,
      image: null,
      rotation: 0,
      brightness: 0,
      contrast: 0,
      saturation: 0,
      cropRatio: null,
      history: [],
      historyIndex: -1
    };
  }

  function captureEditorState() {
    const editor = state.editor;

    return {
      rotation: editor.rotation,
      brightness: editor.brightness,
      contrast: editor.contrast,
      saturation: editor.saturation,
      cropRatio: editor.cropRatio
    };
  }

  function restoreEditorState(snapshot) {
    const editor = state.editor;
    if (!editor) return;

    editor.rotation = snapshot.rotation;
    editor.brightness = snapshot.brightness;
    editor.contrast = snapshot.contrast;
    editor.saturation = snapshot.saturation;
    editor.cropRatio = snapshot.cropRatio;

    updateEditorControls();
    drawEditor();
  }

  function pushEditorHistory() {
    const editor = state.editor;
    if (!editor) return;

    const snapshot = captureEditorState();

    editor.history =
      editor.history.slice(0, editor.historyIndex + 1);

    editor.history.push(snapshot);

    if (editor.history.length > 40) {
      editor.history.shift();
    }

    editor.historyIndex = editor.history.length - 1;

    updateHistoryButtons();
  }

  function undoEditor() {
    const editor = state.editor;

    if (!editor || editor.historyIndex <= 0) return;

    editor.historyIndex -= 1;

    restoreEditorState(
      editor.history[editor.historyIndex]
    );

    updateHistoryButtons();
  }

  function redoEditor() {
    const editor = state.editor;

    if (
      !editor ||
      editor.historyIndex >= editor.history.length - 1
    ) {
      return;
    }

    editor.historyIndex += 1;

    restoreEditorState(
      editor.history[editor.historyIndex]
    );

    updateHistoryButtons();
  }

  function updateHistoryButtons() {
    const editor = state.editor;

    $("undoBtn").disabled =
      !editor || editor.historyIndex <= 0;

    $("redoBtn").disabled =
      !editor ||
      editor.historyIndex >= editor.history.length - 1;
  }

  function updateEditorControls() {
    const editor = state.editor;
    if (!editor) return;

    $("brightnessRange").value = editor.brightness;
    $("contrastRange").value = editor.contrast;
    $("saturationRange").value = editor.saturation;

    $("brightnessValue").textContent = editor.brightness;
    $("contrastValue").textContent = editor.contrast;
    $("saturationValue").textContent = editor.saturation;

    document.querySelectorAll(".crop-btn").forEach((button) => {
      const ratio = button.dataset.ratio;

      const active =
        (editor.cropRatio === null && ratio === "free") ||
        (
          editor.cropRatio !== null &&
          Number(ratio) === editor.cropRatio
        );

      button.classList.toggle("active", active);
    });
  }

  function getFilterString() {
    const editor = state.editor;

    const brightness = 100 + editor.brightness;
    const contrast = 100 + editor.contrast;
    const saturation = 100 + editor.saturation;

    return `
      brightness(${brightness}%)
      contrast(${contrast}%)
      saturate(${saturation}%)
      ${proEditorState && proEditorState.enabled ? getProFilterString() : ""}
    `;
  }

  function getCropRect(width, height, ratio) {
    if (!ratio) {
      return {
        x: 0,
        y: 0,
        width,
        height
      };
    }

    let cropWidth = width;
    let cropHeight = cropWidth / ratio;

    if (cropHeight > height) {
      cropHeight = height;
      cropWidth = cropHeight * ratio;
    }

    return {
      x: (width - cropWidth) / 2,
      y: (height - cropHeight) / 2,
      width: cropWidth,
      height: cropHeight
    };
  }

  function drawEditor() {
    const editor = state.editor;

    if (!editor || !editor.image) return;

    const image = editor.image;

    const sourceWidth =
      image.naturalWidth || image.width;

    const sourceHeight =
      image.naturalHeight || image.height;

    if (!sourceWidth || !sourceHeight) return;

    const rotation =
      ((editor.rotation % 360) + 360) % 360;

    const rotated =
      rotation === 90 || rotation === 270;

    const rotatedWidth =
      rotated ? sourceHeight : sourceWidth;

    const rotatedHeight =
      rotated ? sourceWidth : sourceHeight;

    const maxWidth = Math.max(
      300,
      editorCanvas.parentElement?.clientWidth || 800
    );

    const maxHeight = 520;

    const scale = Math.min(
      maxWidth / rotatedWidth,
      maxHeight / rotatedHeight,
      1
    );

    editorCanvas.width =
      Math.max(1, Math.round(rotatedWidth * scale));

    editorCanvas.height =
      Math.max(1, Math.round(rotatedHeight * scale));

    editorCtx.clearRect(
      0,
      0,
      editorCanvas.width,
      editorCanvas.height
    );

    editorCtx.save();

    editorCtx.filter = getFilterString();

    editorCtx.translate(
      editorCanvas.width / 2,
      editorCanvas.height / 2
    );

    editorCtx.rotate(
      (rotation * Math.PI) / 180
    );

    const drawWidth =
      sourceWidth * scale;

    const drawHeight =
      sourceHeight * scale;

    editorCtx.drawImage(
      image,
      -drawWidth / 2,
      -drawHeight / 2,
      drawWidth,
      drawHeight
    );

    editorCtx.restore();

    drawCropOverlay();
  }

  function drawCropOverlay() {
    if (!editorCanvas) return;

    const editor = state.editor;
    if (!editor) return;

    const ctx = editorCanvas.getContext("2d");

    ctx.save();

    ctx.strokeStyle =
      "rgba(255,255,255,0.95)";

    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);

    if (editor.cropRatio) {
      const crop = getCropRect(
        editorCanvas.width,
        editorCanvas.height,
        editor.cropRatio
      );

      ctx.strokeRect(
        crop.x,
        crop.y,
        crop.width,
        crop.height
      );
    } else {
      ctx.strokeRect(
        4,
        4,
        Math.max(0, editorCanvas.width - 8),
        Math.max(0, editorCanvas.height - 8)
      );
    }

    ctx.restore();
  }

  function openEditor(file) {
    if (!(file instanceof Blob)) return;

    const item = {
      type: "photo",
      name: file.name || "foto.jpg",
      file
    };

    const editor = editorDefaultState(item);

    state.editor = editor;

    // Cada nova foto começa com os recursos Pro zerados.
    proEditorState.enabled = true;
    proEditorState.exposure = 0;
    proEditorState.temperature = 0;
    proEditorState.shadows = 0;
    proEditorState.highlights = 0;
    proEditorState.sharpness = 0;
    proEditorState.filter = "none";

    $("editorFileName").textContent =
      item.name;

    editorModal.classList.remove("hidden");

    const image = new Image();

    image.onload = () => {
      editor.image = image;

      const width =
        image.naturalWidth || image.width;

      const height =
        image.naturalHeight || image.height;

      if (!width || !height) {
        alert(
          "Não foi possível obter as dimensões desta foto."
        );

        closeEditor();
        return;
      }

      editorCanvas.width = width;
      editorCanvas.height = height;

      editor.history = [
        captureEditorState()
      ];

      editor.historyIndex = 0;

      updateEditorControls();
      updateHistoryButtons();

      requestAnimationFrame(drawEditor);
    };

    image.onerror = () => {
      alert("Não foi possível abrir esta foto.");
      closeEditor();
    };

    const reader = new FileReader();

    reader.onload = () => {
      image.src = reader.result;
    };

    reader.onerror = () => {
      alert("Não foi possível ler esta foto.");
      closeEditor();
    };

    reader.readAsDataURL(file);
  }

  function closeEditor() {
    editorModal.classList.add("hidden");

    state.editor = null;

    editorCtx.clearRect(
      0,
      0,
      editorCanvas.width,
      editorCanvas.height
    );

    fileInput.value = "";
  }

  function applyEditorChange(callback) {
    if (!state.editor) return;

    callback(state.editor);

    pushEditorHistory();

    updateEditorControls();
    drawEditor();
  }

  function autoEnhance() {
    applyEditorChange((editor) => {
      editor.brightness = 5;
      editor.contrast = 12;
      editor.saturation = 8;
    });
  }

  function resetEditor() {
    if (!state.editor) return;

    state.editor.rotation = 0;
    state.editor.brightness = 0;
    state.editor.contrast = 0;
    state.editor.saturation = 0;
    state.editor.cropRatio = null;

    pushEditorHistory();

    updateEditorControls();
    drawEditor();
  }

  function rotate(direction) {
    applyEditorChange((editor) => {
      editor.rotation =
        (
          editor.rotation +
          direction * 90 +
          360
        ) % 360;
    });
  }

  function setCropRatio(value) {
    applyEditorChange((editor) => {
      editor.cropRatio =
        value === "free"
          ? null
          : Number(value);
    });
  }

  function renderFinalCanvas() {
    const editor = state.editor;

    if (!editor || !editor.image) {
      return null;
    }

    const image = editor.image;

    const rotation =
      ((editor.rotation % 360) + 360) % 360;

    const rotated =
      rotation === 90 || rotation === 270;

    const sourceWidth =
      image.naturalWidth;

    const sourceHeight =
      image.naturalHeight;

    const rotatedWidth =
      rotated ? sourceHeight : sourceWidth;

    const rotatedHeight =
      rotated ? sourceWidth : sourceHeight;

    const crop = getCropRect(
      rotatedWidth,
      rotatedHeight,
      editor.cropRatio
    );

    const canvas =
      document.createElement("canvas");

    canvas.width =
      Math.max(1, Math.round(crop.width));

    canvas.height =
      Math.max(1, Math.round(crop.height));

    const ctx =
      canvas.getContext("2d");

    ctx.filter = getFilterString();

    ctx.translate(
      canvas.width / 2,
      canvas.height / 2
    );

    ctx.rotate(
      (rotation * Math.PI) / 180
    );

    ctx.drawImage(
      image,
      -sourceWidth / 2 -
        crop.x +
        rotatedWidth / 2,
      -sourceHeight / 2 -
        crop.y +
        rotatedHeight / 2,
      sourceWidth,
      sourceHeight
    );

    ctx.setTransform(
      1,
      0,
      0,
      1,
      0,
      0
    );

    applySharpness(canvas);

    return canvas;
  }

  function saveEditedCopy() {
    if (!state.editor || !state.editor.image) {
      return;
    }

    const canvas =
      renderFinalCanvas();

    if (!canvas) return;

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          alert(
            "Não foi possível criar a cópia editada."
          );
          return;
        }

        const original =
          state.editor.item.name;

        const dot =
          original.lastIndexOf(".");

        const base =
          dot > 0
            ? original.slice(0, dot)
            : original;

        const filename =
          `${base}-photolivemagic.jpg`;

        const url =
          URL.createObjectURL(blob);

        const link =
          document.createElement("a");

        link.href = url;
        link.download = filename;

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(
          () => URL.revokeObjectURL(url),
          2000
        );

        alert(
          "Cópia editada salva. O original permanece intacto."
        );
      },
      "image/jpeg",
      0.94
    );
  }



  const proEditorState = {
    enabled: false,
    exposure: 0,
    temperature: 0,
    shadows: 0,
    highlights: 0,
    sharpness: 0,
    filter: "none"
  };

  function updateProValue(id, value) {
    const element = $(id);
    if (element) element.textContent = value;
  }

  function getProFilterString() {
    const s = proEditorState;

    const brightness = 100 + editorSafeNumber(s.exposure) + editorSafeNumber(s.shadows) * 0.25;
    const contrast = 100 + editorSafeNumber(s.highlights) * 0.35;
    const saturation = 100 + editorSafeNumber(s.temperature) * 0.18;

    const filters = [
      `brightness(${brightness}%)`,
      `contrast(${contrast}%)`,
      `saturate(${saturation}%)`
    ];

    if (s.filter === "warm") {
      filters.push("sepia(12%)");
      filters.push("saturate(112%)");
    }

    if (s.filter === "cool") {
      filters.push("hue-rotate(10deg)");
    }

    if (s.filter === "vintage") {
      filters.push("sepia(28%)");
      filters.push("contrast(94%)");
      filters.push("saturate(82%)");
    }

    if (s.filter === "bw") {
      filters.push("grayscale(100%)");
    }

    if (s.filter === "dramatic") {
      filters.push("contrast(118%)");
      filters.push("saturate(108%)");
    }

    return filters.join(" ");
  }

  function getSharpnessAmount() {
    const value = editorSafeNumber(proEditorState.sharpness);
    return Math.max(0, Math.min(1, value / 100));
  }

  function applySharpness(canvas) {
    const amount = getSharpnessAmount();

    if (!canvas || amount <= 0) {
      return canvas;
    }

    const width = canvas.width;
    const height = canvas.height;

    if (width < 3 || height < 3) {
      return canvas;
    }

    const sourceCtx = canvas.getContext("2d", { willReadFrequently: true });
    if (!sourceCtx) {
      return canvas;
    }

    const source = sourceCtx.getImageData(0, 0, width, height);
    const sourceData = source.data;

    const output = sourceCtx.createImageData(width, height);
    const outputData = output.data;

    const strength = 0.45 * amount;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = (y * width + x) * 4;

        const top = ((y - 1) * width + x) * 4;
        const bottom = ((y + 1) * width + x) * 4;
        const left = (y * width + x - 1) * 4;
        const right = (y * width + x + 1) * 4;

        for (let channel = 0; channel < 3; channel++) {
          const center = sourceData[i + channel];

          const blur =
            (
              sourceData[top + channel] +
              sourceData[bottom + channel] +
              sourceData[left + channel] +
              sourceData[right + channel]
            ) / 4;

          const sharpened =
            center + (center - blur) * strength;

          outputData[i + channel] =
            Math.max(0, Math.min(255, sharpened));
        }

        outputData[i + 3] = sourceData[i + 3];
      }
    }

    // Preserva as bordas da imagem sem aplicar valores inexistentes.
    for (let x = 0; x < width; x++) {
      const top = x * 4;
      const bottom = ((height - 1) * width + x) * 4;

      for (let channel = 0; channel < 4; channel++) {
        outputData[top + channel] = sourceData[top + channel];
        outputData[bottom + channel] = sourceData[bottom + channel];
      }
    }

    for (let y = 0; y < height; y++) {
      const left = (y * width) * 4;
      const right = (y * width + width - 1) * 4;

      for (let channel = 0; channel < 4; channel++) {
        outputData[left + channel] = sourceData[left + channel];
        outputData[right + channel] = sourceData[right + channel];
      }
    }

    sourceCtx.putImageData(output, 0, 0);

    return canvas;
  }

  function editorSafeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function setupProEditor() {
    const toggle = $("proToggleBtn");
    const controls = $("proEditorControls");

    if (toggle && controls) {
      toggle.addEventListener("click", () => {
        const isHidden = controls.hasAttribute("hidden");

        if (isHidden) {
          controls.removeAttribute("hidden");
          toggle.textContent = "Ocultar recursos Pro";
        } else {
          controls.setAttribute("hidden", "");
          toggle.textContent = "Mostrar recursos Pro";
        }
      });
    }

    const ranges = [
      ["exposureRange", "exposureValue", "exposure"],
      ["temperatureRange", "temperatureValue", "temperature"],
      ["shadowsRange", "shadowsValue", "shadows"],
      ["highlightsRange", "highlightsValue", "highlights"],
      ["sharpnessRange", "sharpnessValue", "sharpness"]
    ];

    ranges.forEach(([inputId, valueId, stateKey]) => {
      const input = $(inputId);
      if (!input) return;

      input.addEventListener("input", () => {
        proEditorState[stateKey] = Number(input.value);
        updateProValue(valueId, input.value);
        drawEditor();
      });
    });

    document.querySelectorAll(".pro-filter-btn").forEach((button) => {
      button.addEventListener("click", () => {
        proEditorState.filter = button.dataset.proFilter || "none";

        document.querySelectorAll(".pro-filter-btn").forEach((item) => {
          item.classList.toggle("active", item === button);
        });

        drawEditor();
      });
    });
  }


  setupProEditor();
  proEditorState.enabled = true;

  fileInput.addEventListener(
    "change",
    () => {
      const file =
        fileInput.files?.[0];

      if (file) {
        openEditor(file);
      }
    }
  );

  $("closeEditorBtn").addEventListener(
    "click",
    closeEditor
  );

  editorModal
    .querySelector(".modal-backdrop")
    .addEventListener(
      "click",
      closeEditor
    );

  $("brightnessRange").addEventListener(
    "input",
    (event) => {
      if (!state.editor) return;

      state.editor.brightness =
        Number(event.target.value);

      $("brightnessValue").textContent =
        state.editor.brightness;

      drawEditor();
    }
  );

  $("brightnessRange").addEventListener(
    "change",
    () => {
      if (state.editor) {
        pushEditorHistory();
      }
    }
  );

  $("contrastRange").addEventListener(
    "input",
    (event) => {
      if (!state.editor) return;

      state.editor.contrast =
        Number(event.target.value);

      $("contrastValue").textContent =
        state.editor.contrast;

      drawEditor();
    }
  );

  $("contrastRange").addEventListener(
    "change",
    () => {
      if (state.editor) {
        pushEditorHistory();
      }
    }
  );

  $("saturationRange").addEventListener(
    "input",
    (event) => {
      if (!state.editor) return;

      state.editor.saturation =
        Number(event.target.value);

      $("saturationValue").textContent =
        state.editor.saturation;

      drawEditor();
    }
  );

  $("saturationRange").addEventListener(
    "change",
    () => {
      if (state.editor) {
        pushEditorHistory();
      }
    }
  );

  $("autoEnhanceBtn").addEventListener(
    "click",
    autoEnhance
  );

  $("rotateLeftBtn").addEventListener(
    "click",
    () => rotate(-1)
  );

  $("rotateRightBtn").addEventListener(
    "click",
    () => rotate(1)
  );

  $("undoBtn").addEventListener(
    "click",
    undoEditor
  );

  $("redoBtn").addEventListener(
    "click",
    redoEditor
  );

  $("resetEditorBtn").addEventListener(
    "click",
    resetEditor
  );

  $("saveEditorTopBtn").addEventListener(
    "click",
    saveEditedCopy
  );

  document
    .querySelectorAll(".crop-btn")
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          setCropRatio(
            button.dataset.ratio
          );
        }
      );
    });

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape" &&
        !editorModal.classList.contains("hidden")
      ) {
        closeEditor();
      }

      if (
        event.ctrlKey &&
        event.key.toLowerCase() === "z" &&
        !editorModal.classList.contains("hidden")
      ) {
        event.preventDefault();
        undoEditor();
      }

      if (
        event.ctrlKey &&
        event.key.toLowerCase() === "y" &&
        !editorModal.classList.contains("hidden")
      ) {
        event.preventDefault();
        redoEditor();
      }
    }
  );

  updateHistoryButtons();
})();

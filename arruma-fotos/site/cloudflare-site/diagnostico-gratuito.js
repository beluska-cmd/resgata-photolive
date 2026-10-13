(function () {
  "use strict";

  const state = {
    file: null,
    image: null,
    result: null
  };

  function $(id) {
    return document.getElementById(id);
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1
    );

    return `${(bytes / Math.pow(1024, index)).toFixed(index ? 1 : 0)} ${units[index]}`;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function classifyResolution(width, height) {
    const pixels = width * height;

    if (pixels >= 12000000) return "Alta";
    if (pixels >= 6000000) return "Boa";
    if (pixels >= 2000000) return "Média";

    return "Baixa";
  }

  function analyzeImage(file, image) {
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;

    const canvas = document.createElement("canvas");

    const maxSample = 500;
    const scale = Math.min(
      1,
      maxSample / Math.max(width, height)
    );

    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const ctx = canvas.getContext("2d", {
      willReadFrequently: true
    });

    ctx.drawImage(
      image,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const data = ctx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    ).data;

    let brightnessTotal = 0;
    let contrastTotal = 0;
    let previous = null;
    let darkPixels = 0;
    let brightPixels = 0;

    const count = Math.max(1, data.length / 4);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const luminance =
        0.2126 * r +
        0.7152 * g +
        0.0722 * b;

      brightnessTotal += luminance;

      if (luminance < 45) {
        darkPixels++;
      }

      if (luminance > 220) {
        brightPixels++;
      }

      if (previous !== null) {
        contrastTotal += Math.abs(
          luminance - previous
        );
      }

      previous = luminance;
    }

    const brightness = brightnessTotal / count;
    const averageContrast = contrastTotal / count;

    const darkPercent =
      (darkPixels / count) * 100;

    const brightPercent =
      (brightPixels / count) * 100;

    let brightnessStatus = "Adequado";

    if (brightness < 65) {
      brightnessStatus = "Muito escura";
    } else if (brightness < 95) {
      brightnessStatus = "Escura";
    } else if (brightness > 205) {
      brightnessStatus = "Muito clara";
    } else if (brightness > 175) {
      brightnessStatus = "Clara";
    }

    let contrastStatus = "Adequado";

    if (averageContrast < 18) {
      contrastStatus = "Baixo";
    } else if (averageContrast > 70) {
      contrastStatus = "Alto";
    }

    const resolution =
      classifyResolution(width, height);

    const issues = [];
    const recommendations = [];

    if (resolution === "Baixa") {
      issues.push("Resolução baixa");
      recommendations.push(
        "Upscale e melhoria de definição"
      );
    }

    if (
      brightnessStatus === "Muito escura" ||
      brightnessStatus === "Escura"
    ) {
      issues.push("Iluminação baixa");
      recommendations.push(
        "Correção de brilho e exposição"
      );
    }

    if (
      brightnessStatus === "Muito clara" ||
      brightnessStatus === "Clara"
    ) {
      issues.push("Imagem clara");
      recommendations.push(
        "Ajuste de exposição e realces"
      );
    }

    if (contrastStatus === "Baixo") {
      issues.push("Contraste baixo");
      recommendations.push(
        "Aumento de contraste e definição"
      );
    }

    if (contrastStatus === "Alto") {
      issues.push("Contraste elevado");
      recommendations.push(
        "Ajuste de contraste e recuperação de detalhes"
      );
    }

    if (darkPercent > 35) {
      issues.push(
        "Grande quantidade de áreas escuras"
      );

      recommendations.push(
        "Recuperação de sombras"
      );
    }

    if (brightPercent > 35) {
      issues.push(
        "Grande quantidade de áreas muito claras"
      );

      recommendations.push(
        "Recuperação de altas luzes"
      );
    }

    if (!issues.length) {
      issues.push(
        "Nenhum problema técnico importante detectado"
      );

      recommendations.push(
        "Melhoria estética opcional"
      );
    }

    let severity = "Baixa";

    if (issues.length >= 4) {
      severity = "Alta";
    } else if (issues.length >= 2) {
      severity = "Média";
    }

    let score = 100;

    if (resolution === "Baixa") {
      score -= 25;
    }

    if (resolution === "Média") {
      score -= 10;
    }

    if (brightnessStatus === "Muito escura") {
      score -= 20;
    }

    if (brightnessStatus === "Escura") {
      score -= 10;
    }

    if (brightnessStatus === "Muito clara") {
      score -= 20;
    }

    if (brightnessStatus === "Clara") {
      score -= 10;
    }

    if (contrastStatus === "Baixo") {
      score -= 15;
    }

    if (contrastStatus === "Alto") {
      score -= 10;
    }

    score = clamp(
      Math.round(score),
      20,
      100
    );

    let recommendationTitle =
      "A foto está em boas condições";

    if (severity === "Alta") {
      recommendationTitle =
        "A foto precisa de recuperação";
    } else if (severity === "Média") {
      recommendationTitle =
        "A foto pode receber melhorias";
    }

    return {
      fileName: file.name,
      fileSize: file.size,
      width,
      height,
      pixels: width * height,
      resolution,
      brightness: Math.round(brightness),
      brightnessStatus,
      contrastStatus,
      severity,
      score,
      issues,
      recommendations,
      recommendationTitle
    };
  }

  function showResult(result) {
    const resultBox =
      $("diagnosticoResultado");

    const details =
      $("diagnosticoDetalhes");

    const status =
      $("diagnosticoStatus");

    const score =
      $("diagnosticoScore");

    const recommendations =
      $("diagnosticoRecomendacoes");

    const contratarBtn =
      $("diagnosticoContratarBtn");

    if (!resultBox) {
      console.warn(
        "PhotoLive: área de diagnóstico não encontrada."
      );

      return;
    }

    /*
     * ANALISE + DIAGNOSTICO
     * O resultado técnico continua vindo do cálculo existente.
     * Aqui apenas organizamos a apresentação para o cliente.
     */

    let statusText = result.recommendationTitle;

    if (
      result.severity === "Baixa" &&
      result.contrastStatus === "Baixo"
    ) {
      statusText = "A foto está em boas condições";
    }

    if (status) {
      status.textContent = statusText;
    }

    if (score) {
      score.textContent =
        `${result.score}/100`;
    }

    if (details) {
      details.innerHTML = `
        <div class="diagnostico-detail">
          <strong>📐 Dimensão</strong>
          <span>${result.width} × ${result.height}px</span>
        </div>

        <div class="diagnostico-detail">
          <strong>🖼️ Resolução</strong>
          <span>${result.resolution}</span>
        </div>

        <div class="diagnostico-detail">
          <strong>☀️ Iluminação</strong>
          <span>${result.brightnessStatus}</span>
        </div>

        <div class="diagnostico-detail">
          <strong>◐ Contraste</strong>
          <span>${result.contrastStatus}</span>
        </div>

        <div class="diagnostico-detail">
          <strong>📊 Necessidade de melhoria</strong>
          <span>${result.severity}</span>
        </div>
      `;
    }

    if (recommendations) {
      const diagnosisText =
        result.issues && result.issues.length
          ? result.issues.join(" ")
          : "A análise não identificou problemas técnicos importantes na imagem.";

      const recommendationItems =
        result.recommendations && result.recommendations.length
          ? result.recommendations
          : ["Nenhuma melhoria obrigatória foi identificada."];

      recommendations.innerHTML = `
        <div class="diagnostico-analise-resumo">
          <h4>🔎 Análise técnica</h4>
          <p>${diagnosisText}</p>
        </div>

        <div class="diagnostico-diagnostico-resumo">
          <h4>✨ Diagnóstico</h4>
          <p>
            ${result.recommendationTitle}.
            ${result.severity === "Baixa"
              ? " A imagem está em boas condições e pode receber apenas um aprimoramento opcional."
              : " Identificamos pontos que podem ser aprimorados para melhorar o resultado final."}
          </p>
        </div>

        <div class="diagnostico-melhorias">
          <h4>🛠️ Melhorias recomendadas</h4>
          <ul>
            ${recommendationItems
              .map(item => `<li>${item}</li>`)
              .join("")}
          </ul>
        </div>
      `;
    }

    if (contratarBtn) {
      let buttonText =
        "✨ Quero melhorar minha foto";

      const service =
        getRecommendedService(
          result
        );

      if (service) {
        buttonText =
          `${service.icon} Quero ${service.name.toLowerCase()}`;
      }

      contratarBtn.textContent =
        buttonText;
    }

    resultBox.classList.remove("hidden");

    resultBox.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  function analyzeFile(file) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert(
        "Selecione uma imagem válida."
      );

      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      alert(
        "Para a análise gratuita, selecione uma imagem de até 25 MB."
      );

      return;
    }

    state.file = file;

    const reader = new FileReader();

    reader.onload = function (event) {
      const image = new Image();

      image.onload = function () {
        state.image = image;

        state.result =
          analyzeImage(
            file,
            image
          );

        const fileName =
          $("diagnosticoArquivo");

        if (fileName) {
          fileName.textContent =
            `${file.name} · ${formatBytes(file.size)}`;
        }

        showResult(
          state.result
        );
      };

      image.onerror = function () {
        alert(
          "Não foi possível ler esta imagem."
        );
      };

      image.src =
        event.target.result;
    };

    reader.readAsDataURL(file);
  }

  async function isLoggedIn() {
    try {
      if (
        window.PhotoLiveAuth &&
        typeof window.PhotoLiveAuth.isLoggedIn ===
          "function"
      ) {
        return await window.PhotoLiveAuth.isLoggedIn();
      }
    } catch (error) {
      console.warn(
        "PhotoLive: não foi possível verificar a sessão.",
        error
      );
    }

    return false;
  }

  async function savePendingPhoto() {
    if (!state.file) {
      return null;
    }

    const requestId =
      "plm-" +
      Date.now() +
      "-" +
      Math.random().toString(36).slice(2, 8);

    try {
      const requestData = {
        requestId,
        fileName: state.file.name || "",
        fileType: state.file.type || "",
        fileSize: state.file.size || 0,
        result: state.result || null,
        createdAt: new Date().toISOString()
      };

      sessionStorage.setItem(
        "photolive_diagnostico_pendente",
        JSON.stringify(requestData)
      );

      /*
       * Guarda o arquivo original em IndexedDB.
       * Isso evita colocar uma foto grande dentro do sessionStorage.
       */
      await new Promise((resolve, reject) => {
        const request =
          indexedDB.open(
            "PhotoLiveMagicDB",
            1
          );

        request.onupgradeneeded = function () {
          const db = request.result;

          if (!db.objectStoreNames.contains("fotos_pendentes")) {
            db.createObjectStore(
              "fotos_pendentes",
              { keyPath: "requestId" }
            );
          }
        };

        request.onsuccess = function () {
          const db = request.result;

          try {
            const transaction =
              db.transaction(
                "fotos_pendentes",
                "readwrite"
              );

            const store =
              transaction.objectStore(
                "fotos_pendentes"
              );

            store.put({
              requestId,
              file: state.file,
              result: state.result || null,
              createdAt: new Date().toISOString()
            });

            transaction.oncomplete = resolve;
            transaction.onerror = function () {
              reject(transaction.error);
            };
          } catch (error) {
            reject(error);
          }
        };

        request.onerror = function () {
          reject(request.error);
        };
      });

      return requestId;
    } catch (error) {
      console.error(
        "PhotoLive: não foi possível guardar a foto pendente.",
        error
      );

      return null;
    }
  }

  function getRecommendedService(result) {
    const recommendations =
      (result?.recommendations || [])
        .join(" ")
        .toLowerCase();

    if (
      recommendations.includes("recuper")
    ) {
      /*
       * O serviço "recuperar" existente é voltado à recuperação
       * de arquivos. Para uma foto já carregada e diagnosticada,
       * o processamento disponível nesta V1 é feito pelo editor.
       */
      return {
        slug: "editor-fotos",
        name: "recuperação e melhoria da foto",
        icon: "♻️"
      };
    }

    if (
      recommendations.includes("contraste") ||
      recommendations.includes("defini")
    ) {
      return {
        slug: "editor-fotos",
        name: "melhoria de contraste e definição",
        icon: "✨"
      };
    }

    if (
      recommendations.includes("ilumina")
    ) {
      return {
        slug: "editor-fotos",
        name: "corrigir a iluminação",
        icon: "☀️"
      };
    }

    if (
      recommendations.includes("resolu")
    ) {
      return {
        slug: "editor-fotos",
        name: "melhoria da qualidade da foto",
        icon: "🖼️"
      };
    }

    return {
      slug: "editor-fotos",
      name: "melhoria da foto",
      icon: "✨"
    };
  }

  async function requestService() {
    if (!state.result || !state.file) {
      alert(
        "Analise uma foto primeiro para receber a recomendação correta."
      );

      return;
    }

    const service =
      getRecommendedService(
        state.result
      );

    const requestId =
      await savePendingPhoto();

    if (!requestId) {
      alert(
        "Não foi possível preparar sua foto para o serviço. Tente novamente."
      );

      return;
    }

    sessionStorage.setItem(
      "photolive_servico_pendente",
      JSON.stringify({
        requestId,
        service,
        result: state.result
      })
    );

    const logged =
      await isLoggedIn();

    if (logged) {
      continueToService(
        service,
        requestId
      );

      return;
    }

    /*
     * A escolha e a foto ficam preservadas enquanto
     * o usuário faz login/cadastro.
     */
    if (
      window.PhotoLiveAuth &&
      typeof window.PhotoLiveAuth.login ===
        "function"
    ) {
      /*
       * Guarda o destino do fluxo antes de abrir o login.
       * Depois do login/cadastro, o acesso/acesso/auth.js poderá devolver
       * o usuário diretamente para a tela de pagamento.
       */
      const paymentUrl =
        "pagamentos/pagamento.html?produto=" +
        encodeURIComponent(service?.slug || "editor-fotos") +
        "&pedido=" +
        encodeURIComponent(requestId);

      sessionStorage.setItem(
        "photolive_return_to",
        paymentUrl
      );

      window.PhotoLiveAuth.login();
      return;
    }

    alert(
      "Faça login ou crie sua conta para continuar."
    );
  }

  function continueToService(
    service,
    requestId
  ) {
    const params =
      new URLSearchParams();

    params.set(
      "produto",
      service?.slug || "melhoria-foto"
    );

    if (requestId) {
      params.set(
        "pedido",
        requestId
      );
    }

    window.location.href =
      "pagamentos/pagamento.html?" +
      params.toString();
  }

  function setup() {
    const input =
      $("diagnosticoArquivoInput");

    const button =
      $("diagnosticoSelecionarBtn");

    const serviceButton =
      $("diagnosticoContratarBtn");

    if (!input || !button) {
      return;
    }

    button.addEventListener(
      "click",
      function () {
        input.click();
      }
    );

    input.addEventListener(
      "change",
      function (event) {
        const file =
          event.target.files?.[0];

        if (file) {
          analyzeFile(file);
        }

        input.value = "";
      }
    );

    serviceButton?.addEventListener(
      "click",
      requestService
    );
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      setup
    );
  } else {
    setup();
  }

  window.PhotoLiveDiagnostico = {
    analyzeFile,
    requestService
  };
})();

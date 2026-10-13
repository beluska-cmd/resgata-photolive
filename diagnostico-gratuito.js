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
    const pixels = width * height;

    const canvas = document.createElement("canvas");
    const maxSample = 500;
    const scale = Math.min(1, maxSample / Math.max(width, height));

    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

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

    const luminances = [];

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const luminance =
        0.2126 * r +
        0.7152 * g +
        0.0722 * b;

      luminances.push(luminance);
      brightnessTotal += luminance;

      if (luminance < 45) darkPixels++;
      if (luminance > 220) brightPixels++;

      if (previous !== null) {
        contrastTotal += Math.abs(luminance - previous);
      }

      previous = luminance;
    }

    const count = luminances.length || 1;
    const brightness = brightnessTotal / count;
    const averageContrast = contrastTotal / count;

    const darkPercent = (darkPixels / count) * 100;
    const brightPercent = (brightPixels / count) * 100;

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

    const resolution = classifyResolution(width, height);

    const issues = [];
    const recommendations = [];

    if (resolution === "Baixa") {
      issues.push("Resolução baixa");
      recommendations.push("Upscale e melhoria de definição");
    }

    if (brightnessStatus === "Muito escura" || brightnessStatus === "Escura") {
      issues.push("Iluminação baixa");
      recommendations.push("Correção de brilho e exposição");
    }

    if (
      brightnessStatus === "Muito clara" ||
      brightnessStatus === "Clara"
    ) {
      issues.push("Imagem clara");
      recommendations.push("Ajuste de exposição e realces");
    }

    if (contrastStatus === "Baixo") {
      issues.push("Contraste baixo");
      recommendations.push("Aumento de contraste e definição");
    }

    if (contrastStatus === "Alto") {
      issues.push("Contraste elevado");
      recommendations.push("Ajuste de contraste e recuperação de detalhes");
    }

    if (darkPercent > 35) {
      issues.push("Grande quantidade de áreas escuras");
      recommendations.push("Recuperação de sombras");
    }

    if (brightPercent > 35) {
      issues.push("Grande quantidade de áreas muito claras");
      recommendations.push("Recuperação de altas luzes");
    }

    if (!issues.length) {
      issues.push("Nenhum problema técnico importante detectado");
      recommendations.push("Melhoria estética opcional");
    }

    let severity = "Baixa";

    if (issues.length >= 4) {
      severity = "Alta";
    } else if (issues.length >= 2) {
      severity = "Média";
    }

    let score = 100;

    if (resolution === "Baixa") score -= 25;
    if (resolution === "Média") score -= 10;

    if (brightnessStatus === "Muito escura") score -= 20;
    if (brightnessStatus === "Escura") score -= 10;
    if (brightnessStatus === "Muito clara") score -= 20;
    if (brightnessStatus === "Clara") score -= 10;

    if (contrastStatus === "Baixo") score -= 15;
    if (contrastStatus === "Alto") score -= 10;

    score = clamp(Math.round(score), 20, 100);

    let recommendationTitle = "A foto está em boas condições";

    if (severity === "Alta") {
      recommendationTitle = "A foto precisa de recuperação";
    } else if (severity === "Média") {
      recommendationTitle = "A foto pode receber melhorias";
    }

    return {
      width,
      height,
      pixels,
      resolution,
      brightness,
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
    const resultBox = $("diagnosticoResultado");
    const details = $("diagnosticoDetalhes");
    const status = $("diagnosticoStatus");
    const score = $("diagnosticoScore");
    const recommendations = $("diagnosticoRecomendacoes");

    if (!resultBox) return;

    status.textContent = result.recommendationTitle;
    score.textContent = `${result.score}/100`;

    details.innerHTML = `
      <div class="diagnostico-detail">
        <strong>Dimensão</strong>
        <span>${result.width} × ${result.height}px</span>
      </div>

      <div class="diagnostico-detail">
        <strong>Resolução</strong>
        <span>${result.resolution}</span>
      </div>

      <div class="diagnostico-detail">
        <strong>Iluminação</strong>
        <span>${result.brightnessStatus}</span>
      </div>

      <div class="diagnostico-detail">
        <strong>Contraste</strong>
        <span>${result.contrastStatus}</span>
      </div>

      <div class="diagnostico-detail">
        <strong>Nível de necessidade</strong>
        <span>${result.severity}</span>
      </div>
    `;

    recommendations.innerHTML = result.recommendations
      .map(item => `<li>${item}</li>`)
      .join("");

    resultBox.classList.remove("hidden");

    resultBox.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  function analyzeFile(file) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Selecione uma imagem válida.");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      alert("Para a análise gratuita, selecione uma imagem de até 25 MB.");
      return;
    }

    state.file = file;

    const reader = new FileReader();

    reader.onload = function (event) {
      const image = new Image();

      image.onload = function () {
        state.image = image;
        state.result = analyzeImage(file, image);

        const fileName = $("diagnosticoArquivo");
        if (fileName) {
          fileName.textContent =
            `${file.name} · ${formatBytes(file.size)}`;
        }

        showResult(state.result);
      };

      image.onerror = function () {
        alert("Não foi possível ler esta imagem.");
      };

      image.src = event.target.result;
    };

    reader.readAsDataURL(file);
  }

  function requestService() {
    /*
     * A autenticação existente do PhotoLive Magic será utilizada.
     * Primeiro verificamos se há sessão.
     */

    if (window.PhotoLiveAuth && typeof window.PhotoLiveAuth.isLoggedIn === "function") {
      Promise.resolve(window.PhotoLiveAuth.isLoggedIn())
        .then(function (logged) {
          if (logged) {
            continueToService();
          } else {
            sessionStorage.setItem(
              "photolive_diagnostico_pendente",
              JSON.stringify({
                fileName: state.file?.name || "",
                result: state.result || null
              })
            );

            if (typeof window.PhotoLiveAuth.login === "function") {
              window.PhotoLiveAuth.login();
            } else {
              alert("Faça login para continuar com o serviço.");
            }
          }
        })
        .catch(function () {
          if (typeof window.PhotoLiveAuth.login === "function") {
            window.PhotoLiveAuth.login();
          }
        });

      return;
    }

    alert("Faça login para continuar com a contratação do serviço.");
  }

  function continueToService() {
    sessionStorage.setItem(
      "photolive_diagnostico_pendente",
      JSON.stringify({
        fileName: state.file?.name || "",
        result: state.result || null
      })
    );

    window.location.href = "pagamento.html?produto=diagnostico";
  }

  function setup() {
    const input = $("diagnosticoArquivoInput");
    const button = $("diagnosticoSelecionarBtn");
    const serviceButton = $("diagnosticoContratarBtn");

    if (!input || !button) return;

    button.addEventListener("click", function () {
      input.click();
    });

    input.addEventListener("change", function (event) {
      const file = event.target.files?.[0];

      if (file) {
        analyzeFile(file);
      }

      input.value = "";
    });

    serviceButton?.addEventListener("click", requestService);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();

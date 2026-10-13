(() => {
  const DB_NAME = "PhotoLiveMagicDB";
  const STORE_NAME = "fotos_pendentes";

  function getPendingRequestId() {
    try {
      const saved = sessionStorage.getItem(
        "photolive_servico_pendente"
      );

      if (!saved) return null;

      const data = JSON.parse(saved);

      return data?.requestId || null;
    } catch (error) {
      console.warn(
        "PhotoLive Magic — não foi possível ler o serviço pendente.",
        error
      );

      return null;
    }
  }

  function getPendingService() {
    try {
      const saved = sessionStorage.getItem(
        "photolive_servico_pendente"
      );

      if (!saved) return null;

      return JSON.parse(saved);
    } catch (error) {
      return null;
    }
  }

  function getPendingPhoto(requestId) {
    return new Promise((resolve, reject) => {
      if (!requestId) {
        reject(new Error("Solicitação da foto não encontrada."));
        return;
      }

      const request = indexedDB.open(DB_NAME, 1);

      request.onerror = () => {
        reject(
          request.error ||
          new Error("Não foi possível abrir o armazenamento da foto.")
        );
      };

      request.onupgradeneeded = function () {
        const db = request.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(
            STORE_NAME,
            { keyPath: "requestId" }
          );
        }
      };

      request.onsuccess = function () {
        const db = request.result;

        try {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            reject(
              new Error("A foto pendente não foi encontrada neste dispositivo.")
            );
            return;
          }

          const transaction =
            db.transaction(STORE_NAME, "readonly");

          const store =
            transaction.objectStore(STORE_NAME);

          const getRequest =
            store.get(requestId);

          getRequest.onsuccess = function () {
            if (!getRequest.result?.file) {
              reject(
                new Error(
                  "A foto original não está disponível neste dispositivo."
                )
              );

              return;
            }

            resolve(getRequest.result);
          };

          getRequest.onerror = function () {
            reject(
              getRequest.error ||
              new Error("Não foi possível recuperar a foto pendente.")
            );
          };
        } catch (error) {
          reject(error);
        }
      };
    });
  }

  function calculateAdjustments(diagnosis) {
    let brightness = 0;
    let contrast = 0;

    const brightnessStatus =
      String(diagnosis?.brightnessStatus || "")
        .toLowerCase();

    const contrastStatus =
      String(diagnosis?.contrastStatus || "")
        .toLowerCase();

    if (
      brightnessStatus.includes("muito escura")
    ) {
      brightness = 18;
    } else if (
      brightnessStatus.includes("escura")
    ) {
      brightness = 10;
    } else if (
      brightnessStatus.includes("muito clara")
    ) {
      brightness = -14;
    } else if (
      brightnessStatus.includes("clara")
    ) {
      brightness = -7;
    }

    if (
      contrastStatus.includes("baixo")
    ) {
      contrast = 14;
    }

    return {
      brightness,
      contrast
    };
  }

  function loadImage(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const image = new Image();

      image.onload = function () {
        URL.revokeObjectURL(url);
        resolve(image);
      };

      image.onerror = function () {
        URL.revokeObjectURL(url);
        reject(
          new Error("Não foi possível carregar a foto original.")
        );
      };

      image.src = url;
    });
  }

  function processImage(file, diagnosis) {
    return new Promise(async (resolve, reject) => {
      try {
        const image =
          await loadImage(file);

        const adjustments =
          calculateAdjustments(diagnosis);

        const width =
          image.naturalWidth || image.width;

        const height =
          image.naturalHeight || image.height;

        const canvas =
          document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const ctx =
          canvas.getContext("2d");

        if (!ctx) {
          throw new Error(
            "Não foi possível preparar o processamento da imagem."
          );
        }

        const brightness =
          100 + adjustments.brightness;

        const contrast =
          100 + adjustments.contrast;

        ctx.filter =
          `brightness(${brightness}%) contrast(${contrast}%)`;

        ctx.drawImage(
          image,
          0,
          0,
          width,
          height
        );

        const blob =
          await new Promise((resolveBlob, rejectBlob) => {
            canvas.toBlob(
              (result) => {
                if (!result) {
                  rejectBlob(
                    new Error(
                      "Não foi possível gerar a foto melhorada."
                    )
                  );
                  return;
                }

                resolveBlob(result);
              },
              "image/jpeg",
              0.94
            );
          });

        resolve({
          blob,
          width,
          height,
          adjustments
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async function processPendingPhoto() {
    const pending =
      getPendingService();

    const requestId =
      getPendingRequestId();

    if (!pending || !requestId) {
      throw new Error(
        "Não existe uma foto aguardando processamento."
      );
    }

    const photo =
      await getPendingPhoto(requestId);

    const diagnosis =
      pending.result ||
      photo.result ||
      {};

    const result =
      await processImage(
        photo.file,
        diagnosis
      );

    return {
      requestId,
      originalFile: photo.file,
      result,
      diagnosis,
      service: pending.service || null
    };
  }

  function createDownload(result, fileName) {
    const url =
      URL.createObjectURL(result.blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download =
      `${fileName || "foto"}-photolive-magic.jpg`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 2000);
  }

  window.PhotoLiveProcessing = {
    processPendingPhoto,
    createDownload
  };
})();

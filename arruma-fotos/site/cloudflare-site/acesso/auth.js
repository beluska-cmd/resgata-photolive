(function () {
  "use strict";

  const CONFIG = window.PHOTOLIVE_SUPABASE || {};
  const hasConfig =
    CONFIG.url &&
    CONFIG.anonKey &&
    !CONFIG.url.includes("COLE_AQUI") &&
    !CONFIG.anonKey.includes("COLE_AQUI");

  let supabaseClient = null;

  const $ = (id) => document.getElementById(id);

  function message(text, type = "info") {
    const el = $("authMessage");
    if (!el) return;

    el.textContent = text;
    el.className = "photolive-auth-message " + type;
  }

  function openModal(mode = "login") {
    const modal = $("accountModal");
    if (!modal) return;

    modal.classList.remove("hidden");

    showMode(mode);
  }

  function closeModal() {
    $("accountModal")?.classList.add("hidden");
  }

  function showMode(mode) {
    document
      .querySelectorAll(".photolive-auth-mode")
      .forEach((el) => el.classList.add("hidden"));

    const target = $("auth-" + mode);

    if (target) {
      target.classList.remove("hidden");
    }

    message("");

    if (mode === "login") {
      $("authTitle").textContent = "Entrar no PhotoLive Magic";
      $("authSubtitle").textContent =
        "Acesse sua conta para continuar.";
    }

    if (mode === "register") {
      $("authTitle").textContent = "Criar sua conta";
      $("authSubtitle").textContent =
        "Comece a usar o PhotoLive Magic.";
    }

    if (mode === "forgot") {
      $("authTitle").textContent = "Recuperar acesso";
      $("authSubtitle").textContent =
        "Enviaremos um link para redefinir sua senha.";
    }

    if (mode === "account") {
      $("authTitle").textContent = "Minha conta";
      $("authSubtitle").textContent =
        "Gerencie seu acesso ao PhotoLive Magic.";
    }
  }

  function requireConfig() {
    if (hasConfig) return true;

    message(
      "A autenticação ainda precisa ser configurada no Supabase.",
      "error"
    );

    return false;
  }

  async function init() {
    if (!window.supabase) {
      console.error("Supabase JS não carregado.");
      return;
    }

    if (!hasConfig) {
      console.warn(
        "PhotoLive Magic: configure auth-config.js."
      );
      return;
    }

    supabaseClient = window.supabase.createClient(
      CONFIG.url,
      CONFIG.anonKey
    );

    const {
      data: { session }
    } = await supabaseClient.auth.getSession();

    updateAccountUI(session);

    supabaseClient.auth.onAuthStateChange(
      (_event, session) => {
        updateAccountUI(session);
      }
    );
  }

  function updateAccountUI(session) {

    document.body.classList.toggle(
      "photolive-logged-in",
      !!session
    );

    const accountSection =
      document.getElementById("minha-conta");

    if (accountSection) {
      accountSection.style.display =
        session ? "block" : "none";
    }

    const emailElement =
      document.getElementById("photoliveClientEmail");

    if (emailElement) {
      emailElement.textContent =
        session?.user?.email ||
        "Conta PhotoLive Magic";
    }

    const loginButtons =
      document.querySelectorAll("[data-auth-login]");

    const accountButtons =
      document.querySelectorAll("[data-auth-account]");

    loginButtons.forEach((button) => {
      button.classList.toggle("hidden", !!session);
    });

    accountButtons.forEach((button) => {
      button.classList.toggle("hidden", !session);
    });

    if (session) {
      const email =
        session.user?.email || "Usuário";

      const emailElements =
        document.querySelectorAll("[data-auth-email]");

      emailElements.forEach((el) => {
        el.textContent = email;
      });
    }
  }

  async function login(email, password) {
    if (!requireConfig()) return;

    const button = $("loginSubmit");

    if (button) {
      button.disabled = true;
      button.textContent = "Entrando...";
    }

    const { error } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

    if (button) {
      button.disabled = false;
      button.textContent = "Entrar";
    }

    if (error) {
      message(
        traduzErro(error.message),
        "error"
      );
      return;
    }

    message("Login realizado com sucesso.", "success");

    setTimeout(() => {
      closeModal();

      // Após o login, o destino principal do cliente é sempre
      // a Central PhotoLive / Minha Conta.
      // O Meu Espaço permanece disponível dentro da conta.
      sessionStorage.removeItem("photolive_return_to");

      window.location.href = "../conta/minha-conta.html";
    }, 500);
  }

  async function register(email, password) {
    if (!requireConfig()) return;

    const button = $("registerSubmit");

    if (button) {
      button.disabled = true;
      button.textContent = "Criando...";
    }

    const { data, error } =
      await supabaseClient.auth.signUp({
        email,
        password
      });

    if (button) {
      button.disabled = false;
      button.textContent = "Criar conta";
    }

    if (error) {
      message(
        traduzErro(error.message),
        "error"
      );
      return;
    }

    if (data.session) {
      message(
        "Conta criada e login realizado.",
        "success"
      );

      setTimeout(() => {
        closeModal();

        const params = new URLSearchParams(window.location.search);
        const urlReturnTo = params.get("returnTo");
        const savedReturnTo = sessionStorage.getItem("photolive_return_to");

        const returnTo = urlReturnTo || savedReturnTo;

        if (returnTo) {
          sessionStorage.removeItem("photolive_return_to");

          try {
            const target = new URL(returnTo, window.location.origin);

            if (target.origin === window.location.origin) {
              window.location.href = target.href;
              return;
            }
          } catch (error) {
            console.warn("PhotoLive Magic — retorno inválido:", error);
          }
        }

        window.location.reload();
      }, 700);

      return;
    }

    message(
      "Conta criada. Verifique seu e-mail para confirmar o cadastro.",
      "success"
    );
  }

  async function forgotPassword(email) {
    if (!requireConfig()) return;

    const button = $("forgotSubmit");

    if (button) {
      button.disabled = true;
      button.textContent = "Enviando...";
    }

    const redirectTo =
      window.location.origin +
      window.location.pathname +
      "?reset=1";

    const { error } =
      await supabaseClient.auth.resetPasswordForEmail(
        email,
        { redirectTo }
      );

    if (button) {
      button.disabled = false;
      button.textContent = "Enviar link";
    }

    if (error) {
      message(
        traduzErro(error.message),
        "error"
      );
      return;
    }

    message(
      "Se esse e-mail estiver cadastrado, enviaremos as instruções de recuperação.",
      "success"
    );
  }

  async function updatePassword(password) {
    if (!requireConfig()) return;

    const { error } =
      await supabaseClient.auth.updateUser({
        password
      });

    if (error) {
      message(
        traduzErro(error.message),
        "error"
      );
      return;
    }

    message(
      "Senha alterada com sucesso.",
      "success"
    );

    setTimeout(() => {
      closeModal();
    }, 800);
  }

  async function googleLogin() {
    if (!requireConfig()) return;

    const redirectTo =
      window.location.origin +
      window.location.pathname;

    const { error } =
      await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo
        }
      });

    if (error) {
      message(
        traduzErro(error.message),
        "error"
      );
    }
  }

  async function logout() {
    if (!supabaseClient) return;

    await supabaseClient.auth.signOut();

    window.location.reload();
  }

  function traduzErro(error) {
    const text = String(error || "").toLowerCase();

    if (text.includes("invalid login credentials")) {
      return "E-mail ou senha incorretos.";
    }

    if (text.includes("email not confirmed")) {
      return "Confirme seu e-mail antes de entrar.";
    }

    if (text.includes("user already registered")) {
      return "Este e-mail já possui uma conta.";
    }

    if (text.includes("password")) {
      return "A senha informada não atende aos requisitos.";
    }

    if (text.includes("rate limit")) {
      return "Muitas tentativas. Aguarde um pouco e tente novamente.";
    }

    return "Supabase: " + String(error || "erro desconhecido");
  }

  function setup() {
    $("openLoginBtn")?.addEventListener(
      "click",
      () => openModal("login")
    );

    $("openRegisterBtn")?.addEventListener(
      "click",
      () => openModal("register")
    );

    $("openAccountBtn")?.addEventListener(
      "click",
      () => openModal("account")
    );

    $("closeAccountModal")?.addEventListener(
      "click",
      closeModal
    );

    $("accountBackdrop")?.addEventListener(
      "click",
      closeModal
    );

    $("showRegisterBtn")?.addEventListener(
      "click",
      () => showMode("register")
    );

    $("showLoginBtn")?.addEventListener(
      "click",
      () => showMode("login")
    );

    $("showForgotBtn")?.addEventListener(
      "click",
      () => showMode("forgot")
    );

    $("backToLoginBtn")?.addEventListener(
      "click",
      () => showMode("login")
    );

    $("googleLoginBtn")?.addEventListener(
      "click",
      googleLogin
    );

    $("googleRegisterBtn")?.addEventListener(
      "click",
      googleLogin
    );

    $("loginForm")?.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();

        const email =
          $("loginEmail")?.value.trim();

        const password =
          $("loginPassword")?.value;

        if (!email || !password) {
          message(
            "Preencha e-mail e senha.",
            "error"
          );
          return;
        }

        login(email, password);
      }
    );

    $("registerForm")?.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();

        const email =
          $("registerEmail")?.value.trim();

        const password =
          $("registerPassword")?.value;

        const confirm =
          $("registerPasswordConfirm")?.value;

        if (!email || !password || !confirm) {
          message(
            "Preencha todos os campos.",
            "error"
          );
          return;
        }

        if (password !== confirm) {
          message(
            "As senhas não são iguais.",
            "error"
          );
          return;
        }

        if (password.length < 6) {
          message(
            "A senha precisa ter pelo menos 6 caracteres.",
            "error"
          );
          return;
        }

        register(email, password);
      }
    );

    $("forgotForm")?.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();

        const email =
          $("forgotEmail")?.value.trim();

        if (!email) {
          message(
            "Digite seu e-mail.",
            "error"
          );
          return;
        }

        forgotPassword(email);
      }
    );

    $("newPasswordForm")?.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();

        const password =
          $("newPassword")?.value;

        const confirm =
          $("newPasswordConfirm")?.value;

        if (!password || password.length < 6) {
          message(
            "A nova senha precisa ter pelo menos 6 caracteres.",
            "error"
          );
          return;
        }

        if (password !== confirm) {
          message(
            "As senhas não são iguais.",
            "error"
          );
          return;
        }

        updatePassword(password);
      }
    );

    $("logoutBtn")?.addEventListener(
      "click",
      logout
    );

    const params =
      new URLSearchParams(window.location.search);

    if (params.get("reset") === "1") {
      setTimeout(() => {
        openModal("new-password");
      }, 300);
    }
  }

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      setup();
      init();
    }
  );

  window.PhotoLiveAuth = {
    open: openModal,
    close: closeModal,
    login: () => openModal("login"),
    register: () => openModal("register"),
    logout,
    hasSession: async () => {
      if (!supabaseClient) return false;

      const {
        data: { session }
      } = await supabaseClient.auth.getSession();

      return !!session;
    }
  };
})();

/* =========================================================
   PHOTOLIVE MAGIC — ÁREA DO CLIENTE
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  const accountButton =
    document.getElementById("openAccountBtn");

  if (accountButton) {
    accountButton.addEventListener("click", async () => {

      const hasSession =
        await window.PhotoLiveAuth?.hasSession();

      if (!hasSession) {
        window.PhotoLiveAuth?.login();
        return;
      }

      window.location.href = "../conta/minha-conta.html";
    });
  }

  document
    .getElementById("photoliveAccountLogout")
    ?.addEventListener("click", async () => {
      await window.PhotoLiveAuth?.logout();
    });

  document
    .querySelectorAll(".photolive-client-service-btn")
    .forEach((button) => {

      button.addEventListener("click", () => {

        const service =
          button.dataset.clientService || "serviço";

        const notice =
          document.getElementById("productNotice");

        const text =
          document.getElementById("productNoticeText");

        if (text) {
          text.textContent =
            service +
            " está disponível para contratação. " +
            "O próximo passo será conectado ao checkout.";
        }

        notice?.classList.remove("hidden");
      });

    });

});

/* =========================================================
   PHOTO LIVE MAGIC — BOTÕES DE PRODUTO
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  document
    .querySelectorAll(".photolive-login-required")
    .forEach((button) => {

      button.addEventListener("click", async () => {

        const product =
          button.dataset.product || "produto";

        const sessionExists =
          await window.PhotoLiveAuth?.hasSession();

        if (sessionExists) {
          const accountSection =
            document.getElementById("minha-conta");

          if (accountSection) {
            accountSection.style.display = "block";

            accountSection.scrollIntoView({
              behavior: "smooth",
              block: "start"
            });
          }

          return;
        }

        window.PhotoLiveAuth?.login();
      });
    });

  document
    .getElementById("productNoticeLogin")
    ?.addEventListener("click", () => {
      document
        .getElementById("productNotice")
        ?.classList.add("hidden");

      window.PhotoLiveAuth?.login();
    });
});

async function api(url) {
  const response = await fetch(url);
  return response.json();
}

async function loadServices() {
  const data = await api("/api/services");
  const container = document.getElementById("services");

  container.innerHTML = data.services.map(service => `
    <article class="card">
      <div class="category">${service.category}</div>
      <h3>${service.name}</h3>
      <p>${service.description}</p>
      <button onclick="openService('${service.id}')">Acessar</button>
    </article>
  `).join("");
}

function openService(id) {
  const result = document.getElementById("result");
  result.style.display = "block";
  result.innerHTML = `
    <strong>Serviço selecionado:</strong> ${id}
    <p>Este serviço será conectado ao aplicativo e aos recursos reais do Resgata+ nas próximas etapas.</p>
  `;
}

async function loadDevices() {
  const data = await api("/api/devices");
  showResult("Meus dispositivos", JSON.stringify(data.devices));
}

async function loadSupport() {
  const data = await api("/api/support");
  showResult("Suporte", data.message);
}

async function loadAccount() {
  const data = await api("/api/account");
  showResult(
    "Minha conta",
    `Status: ${data.account.status}<br>Plano: ${data.account.plan}`
  );
}

function showResult(title, content) {
  const result = document.getElementById("result");
  result.style.display = "block";
  result.innerHTML = `<strong>${title}</strong><p>${content}</p>`;
}

loadServices();

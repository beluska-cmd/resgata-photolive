import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8788;

app.use(express.json());

const services = [
  {
    id: "recovery",
    name: "Recuperação",
    description: "Recursos para localizar e recuperar arquivos e informações.",
    category: "Recuperar",
    enabled: true,
    clientVisible: true
  },
  {
    id: "protection",
    name: "Proteção",
    description: "Ferramentas e orientações para proteger seus dados e dispositivo.",
    category: "Segurança",
    enabled: true,
    clientVisible: true
  },
  {
    id: "backup",
    name: "Backup",
    description: "Organize e acompanhe seus backups.",
    category: "Dados",
    enabled: true,
    clientVisible: true
  },
  {
    id: "diagnostics",
    name: "Diagnóstico",
    description: "Acompanhe diagnósticos realizados pelo aplicativo.",
    category: "Dispositivo",
    enabled: true,
    clientVisible: true
  },
  {
    id: "updates",
    name: "Atualizações",
    description: "Informações sobre versões e atualizações do Resgata+.",
    category: "Aplicativo",
    enabled: true,
    clientVisible: true
  },
  {
    id: "support",
    name: "Suporte",
    description: "Solicite ajuda e acompanhe seus atendimentos.",
    category: "Atendimento",
    enabled: true,
    clientVisible: true
  }
];

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "resgata-platform",
    version: "1.0.0"
  });
});

app.get("/api/services", (_req, res) => {
  res.json({
    ok: true,
    services: services.filter(
      service => service.enabled && service.clientVisible
    )
  });
});

app.get("/api/admin/services", (_req, res) => {
  res.json({
    ok: true,
    services
  });
});

const accounts = new Map();
const sessions = new Map();
const tickets = [];
const updates = [
  {
    version: "1.0.0",
    type: "Aplicativo",
    description: "Primeira versão integrada do Resgata+.",
    status: "Disponível"
  }
];

function currentAccount(req) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  return token ? sessions.get(token) : null;
}

app.post("/api/auth/register", (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({
      ok: false,
      error: "Nome, e-mail e senha são obrigatórios."
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      ok: false,
      error: "A senha deve ter pelo menos 8 caracteres."
    });
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (accounts.has(normalizedEmail)) {
    return res.status(409).json({
      ok: false,
      error: "Este e-mail já está cadastrado."
    });
  }

  accounts.set(normalizedEmail, {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: normalizedEmail,
    password,
    plan: "gratuito",
    status: "active"
  });

  res.json({
    ok: true,
    message: "Conta criada com sucesso."
  });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  const account = accounts.get(String(email || "").toLowerCase().trim());

  if (!account || account.password !== password) {
    return res.status(401).json({
      ok: false,
      error: "E-mail ou senha inválidos."
    });
  }

  const token = crypto.randomUUID();
  sessions.set(token, account);

  res.json({
    ok: true,
    token,
    message: "Login realizado com sucesso."
  });
});

app.post("/api/auth/logout", (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) sessions.delete(token);

  res.json({
    ok: true,
    message: "Sessão encerrada."
  });
});

app.get("/api/account", (req, res) => {
  const account = currentAccount(req);

  if (!account) {
    return res.json({
      ok: true,
      account: {
        status: "guest",
        name: "Visitante",
        plan: "gratuito"
      }
    });
  }

  res.json({
    ok: true,
    account: {
      id: account.id,
      status: account.status,
      name: account.name,
      email: account.email,
      plan: account.plan
    }
  });
});

app.get("/api/devices", (_req, res) => {
  res.json({
    ok: true,
    devices: []
  });
});

app.get("/api/updates", (_req, res) => {
  res.json({
    ok: true,
    updates
  });
});

app.post("/api/support/tickets", (req, res) => {
  const { subject, description } = req.body || {};

  if (!subject || !description) {
    return res.status(400).json({
      ok: false,
      error: "Assunto e descrição são obrigatórios."
    });
  }

  const ticket = {
    id: crypto.randomUUID(),
    subject,
    description,
    status: "aberto",
    createdAt: new Date().toISOString()
  };

  tickets.push(ticket);

  res.json({
    ok: true,
    message: "Solicitação registrada com sucesso.",
    ticket
  });
});

app.get("/api/admin/users", (_req, res) => {
  res.json({
    ok: true,
    users: [...accounts.values()].map(account => ({
      id: account.id,
      name: account.name,
      email: account.email,
      plan: account.plan,
      status: account.status
    }))
  });
});

app.get("/api/admin/tickets", (_req, res) => {
  res.json({
    ok: true,
    tickets
  });
});

app.get("/api/support", (_req, res) => {
  res.json({
    ok: true,
    status: "available",
    message: "Central de suporte Resgata+ disponível."
  });
});

app.use("/admin", express.static(path.join(__dirname, "../admin")));
app.use("/", express.static(path.join(__dirname, "../client")));

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      ok: false,
      error: "Endpoint não encontrado"
    });
  }

  res.status(404).send("Página não encontrada");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Resgata+ Central rodando na porta ${PORT}`);
});

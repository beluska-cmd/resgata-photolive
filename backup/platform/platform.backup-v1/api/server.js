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

app.get("/api/account", (_req, res) => {
  res.json({
    ok: true,
    account: {
      status: "guest",
      name: "Visitante",
      plan: "gratuito"
    }
  });
});

app.get("/api/devices", (_req, res) => {
  res.json({
    ok: true,
    devices: []
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

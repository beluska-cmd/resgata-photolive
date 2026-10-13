const SERVICES = {
  "editor-fotos": {
    name: "Editor de Fotos",
    description: "Ajuste brilho, contraste, saturação, corte e rotação.",
    prices: { AVULSO: 590, MONTHLY: 990, YEARLY: 9900 }
  },
  "editor-videos": {
    name: "Editor de Vídeos",
    description: "Corte, ajuste, gire, silencie e personalize vídeos.",
    prices: { AVULSO: 790, MONTHLY: 1290, YEARLY: 12900 }
  },
  "recuperar": {
    name: "Recuperar",
    description: "Análise de locais e arquivos compatíveis para recuperação.",
    prices: { AVULSO: 1490, MONTHLY: 1990, YEARLY: 19900 }
  },
  "diagnostico": {
    name: "Diagnóstico",
    description: "Analise fotos, vídeos e arquivos para encontrar problemas.",
    prices: { AVULSO: 590, MONTHLY: 790, YEARLY: 7900 }
  },
  "pacote-essencial": {
    name: "Pacote Essencial",
    description: "Editor de Fotos + Diagnóstico.",
    prices: { AVULSO: 1290, MONTHLY: 1490, YEARLY: 14900 }
  },
  "pacote-completo": {
    name: "Pacote Completo",
    description: "Fotos + Vídeos + Recuperar + Diagnóstico.",
    prices: { AVULSO: 2490, MONTHLY: 2990, YEARLY: 29900 }
  },
  "premium": {
    name: "Premium",
    description: "Experiência completa com os recursos Premium disponíveis.",
    prices: { AVULSO: 3490, MONTHLY: 3490, YEARLY: 34900 }
  }
};

const PLAN_LABELS = {
  AVULSO: "Avulso",
  MONTHLY: "Mensal",
  YEARLY: "Anual"
};

module.exports = { SERVICES, PLAN_LABELS };

const PAGBANK_API =
  process.env.PAGBANK_API_URL ||
  "https://sandbox.api.pagseguro.com";

function requireToken() {
  if (!process.env.PAGBANK_TOKEN) {
    throw new Error("PAGBANK_TOKEN não configurado.");
  }

  return process.env.PAGBANK_TOKEN;
}

async function createCheckout(payload) {
  const token = requireToken();

  const response = await fetch(
    `${PAGBANK_API}/checkouts`,
    {
      method: "POST",

      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },

      body: JSON.stringify(payload)
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(
      data?.message ||
      data?.error ||
      "Erro ao criar checkout PagBank."
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}

module.exports = {
  createCheckout
};

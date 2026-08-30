const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Wrapper de fetch que já aponta para a API, anexa o token (se houver) e
 * padroniza o tratamento de erro. Lança um Error com a mensagem vinda do
 * backend sempre que a resposta não for 2xx.
 */
export async function apiFetch(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // resposta sem corpo JSON (ex: 204) — segue sem dados
  }

  if (!res.ok) {
    throw new Error(data?.error || 'Não foi possível completar a operação.');
  }

  return data;
}

/**
 * Baixa um arquivo binário (PDF/Excel) autenticado e dispara o download no
 * navegador — usado pelos relatórios, que exigem o token no header e por
 * isso não podem ser um simples link <a href>.
 */
export async function apiDownload(path, { token, filename } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api${path}`, { headers });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || 'Não foi possível gerar o arquivo.');
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'relatorio';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

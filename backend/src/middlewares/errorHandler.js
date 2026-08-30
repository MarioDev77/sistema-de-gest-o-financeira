// Middleware central de erros. Mantém mensagens genéricas para o cliente e
// loga o detalhe completo só no servidor — evita vazar stack trace/detalhes
// internos do banco para o frontend.
function errorHandler(err, req, res, next) {
  console.error(err);

  // Erros de constraint do PostgreSQL (ex: violação de UNIQUE)
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Registro já existe (valor duplicado).' });
  }
  if (err.code === '23503') {
    return res.status(409).json({ error: 'Operação viola integridade referencial.' });
  }
  if (err.code === '23514') {
    return res.status(400).json({ error: 'Valor inválido para um dos campos.' });
  }

  const status = err.status || 500;
  const message =
    status === 500 ? 'Erro interno do servidor.' : err.message || 'Erro.';

  res.status(status).json({ error: message });
}

module.exports = errorHandler;

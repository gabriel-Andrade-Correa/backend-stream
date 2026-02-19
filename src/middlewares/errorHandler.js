function notFoundHandler(req, res) {
  res.status(404).json({ message: 'Rota não encontrada' });
}

function errorHandler(error, req, res, next) {
  console.error(error);
  res.status(error.status || 500).json({
    message: error.message || 'Erro interno no servidor'
  });
}

module.exports = { notFoundHandler, errorHandler };

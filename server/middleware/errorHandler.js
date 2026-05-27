function errorHandler(err, req, res, _next) {
  console.error('[Error]', err.message);
  console.error(err.stack);

  const status = err.status || 500;
  // 500+ 错误不向客户端暴露内部细节（如 SQL 错误、文件路径等）
  const message = status >= 500 ? '服务器内部错误' : (err.message || '服务器内部错误');
  res.status(status).json({
    code: status,
    message,
  });
}

module.exports = errorHandler;

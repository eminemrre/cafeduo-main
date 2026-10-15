const executeDataMode = async (isDbConnected, handlers) => {
  const isConnected = await isDbConnected();
  if (isConnected) {
    return handlers.db();
  }
  return handlers.memory();
};

const buildApiErrorPayload = (res, { code, message, details = null, status = 500 }) => ({
  code: String(code || 'INTERNAL_ERROR'),
  message: String(message || 'Internal server error'),
  details,
  requestId: res?.req?.requestId || null,
  // Backward compatibility
  error: String(message || 'Internal server error'),
  status: Number(status) || 500,
});

const sendApiProblem = (res, { status = 400, code = 'BAD_REQUEST', message, details = null }) => {
  const payload = buildApiErrorPayload(res, { code, message, details, status });
  return res.status(status).json(payload);
};

const sendApiError = (res, logger, context, err, message, status = 500) => {
  const diagnostic = {
    message: context,
    errorCode: err?.code || 'INTERNAL_ERROR',
    errorName: err?.name || 'Error',
    requestId: res?.req?.requestId || null,
  };
  if (logger && typeof logger.error === 'function') logger.error(diagnostic);
  else console.error(diagnostic);
  // SQL metadata, exception messages, and arbitrary error codes are internal only.
  const payload = buildApiErrorPayload(res, {
    code: status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED',
    message: message || 'İşlem şu anda tamamlanamadı.',
    details: null,
    status,
  });
  return res.status(status).json(payload);
};

module.exports = {
  executeDataMode,
  buildApiErrorPayload,
  sendApiProblem,
  sendApiError,
};

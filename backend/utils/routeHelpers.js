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
  if (logger && typeof logger.error === 'function') {
    logger.error(`${context}:`, err);
  } else {
    console.error(`${context}:`, err);
  }
  const payload = buildApiErrorPayload(res, {
    code: err?.code || 'INTERNAL_ERROR',
    message,
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

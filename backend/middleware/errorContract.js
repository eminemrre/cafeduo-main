class ApiError extends Error {
  constructor({
    status = 500,
    code = 'INTERNAL_ERROR',
    message = 'Internal server error',
    details = null,
  } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const createValidationError = (details, message = 'İstek doğrulama hatası.') =>
  new ApiError({
    status: 400,
    code: 'VALIDATION_ERROR',
    message,
    details: Array.isArray(details) ? details : null,
  });

const formatErrorResponse = (req, { status, code, message, details }) => ({
  code,
  message,
  details: details || null,
  requestId: req.requestId || null,
  // Backward compatibility for existing frontend reads.
  error: message,
  status,
});

const notFoundHandler = (req, res) => {
  const payload = formatErrorResponse(req, {
    status: 404,
    code: 'ROUTE_NOT_FOUND',
    message: 'Route not found',
    details: { path: req.originalUrl },
  });
  return res.status(404).json(payload);
};

const createErrorHandler = ({ logger } = {}) => {
  const log = logger && typeof logger.error === 'function' ? logger.error : console.error;
  return (err, req, res, next) => {
    const normalized = (() => {
      if (err instanceof ApiError) return err;

      if (err?.name === 'JsonWebTokenError') {
        return new ApiError({ status: 403, code: 'TOKEN_INVALID', message: 'Invalid token' });
      }
      if (err?.name === 'TokenExpiredError') {
        return new ApiError({ status: 403, code: 'TOKEN_EXPIRED', message: 'Token expired' });
      }
      if (err?.code === '23505') {
        return new ApiError({ status: 409, code: 'DUPLICATE_ENTRY', message: 'Resource already exists' });
      }
      if (err?.code === '23503') {
        return new ApiError({
          status: 400,
          code: 'FOREIGN_KEY_VIOLATION',
          message: 'Referenced resource not found',
        });
      }

      return new ApiError({
        status: Number(err?.status) || 500,
        code: String(err?.code || 'INTERNAL_ERROR'),
        message: process.env.NODE_ENV === 'development'
          ? String(err?.message || 'Internal server error')
          : 'Internal server error',
      });
    })();

    log({
      message: err?.message || normalized.message,
      stack: err?.stack,
      path: req.originalUrl,
      method: req.method,
      requestId: req.requestId,
      userId: req.user?.id,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });

    const payload = formatErrorResponse(req, normalized);
    return res.status(normalized.status).json(payload);
  };
};

module.exports = {
  ApiError,
  createValidationError,
  notFoundHandler,
  createErrorHandler,
};

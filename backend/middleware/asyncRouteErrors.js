/**
 * Express 4 does not catch rejected promises from async route handlers: the
 * rejection escapes as an `unhandledRejection`, and server.js exits on that, so
 * one failed `pool.connect()` took the whole API down and every request got a
 * 502 from the proxy until the container restarted.
 *
 * Installing this patch makes every handler's returned promise forward its
 * rejection to `next(err)`, so it reaches `handleApiError` and becomes a normal
 * error response. It patches the router layer once, process-wide, which is why
 * it must be installed before the first request (server.js does it at boot).
 */
const Layer = require('express/lib/router/layer');

const PATCHED = Symbol.for('cafeduo.asyncRouteErrors');

const forwardRejection = (result, next) => {
  if (result && typeof result.then === 'function' && typeof result.catch === 'function') {
    result.catch((err) => next(err || new Error('Route handler rejected without a reason')));
  }
};

function installAsyncRouteErrors() {
  if (Layer.prototype[PATCHED]) return;

  Layer.prototype.handle_request = function handle(req, res, next) {
    const fn = this.handle;
    if (fn.length > 3) {
      // An error handler; Express calls it through handle_error.
      return next();
    }
    try {
      forwardRejection(fn(req, res, next), next);
    } catch (err) {
      next(err);
    }
  };

  Layer.prototype.handle_error = function handleError(error, req, res, next) {
    const fn = this.handle;
    if (fn.length !== 4) {
      // Not an error handler; pass the error along.
      return next(error);
    }
    try {
      forwardRejection(fn(error, req, res, next), next);
    } catch (err) {
      next(err);
    }
  };

  Layer.prototype[PATCHED] = true;
}

module.exports = { installAsyncRouteErrors };

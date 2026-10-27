(function publishDiagnosticPrivacy(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.__CAFEDUO_DIAGNOSTIC_PRIVACY__ = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createDiagnosticPrivacy() {
  // Diagnostics do not need query values, fragments, credentials or raw request
  // contents. Strip all query/fragment data, not a list of today's token names.
  const stripUrl = (value) =>
    value.split(/[?#]/, 1)[0].replace(/^((?:[a-z][a-z\d+.-]*:)?\/\/)[^/]*@/i, '$1');

  const cleanString = (value, key) => {
    if (['contextline', 'precontext', 'postcontext'].includes(key)) return value;
    if (
      /(url|uri|referer|referrer|filename|abspath|httptarget)/.test(key) ||
      key === 'from' ||
      key === 'to'
    ) {
      return stripUrl(value);
    }
    // URLs also appear inside exception messages and span descriptions.
    return value.replace(/(?:(?:https?|wss?|ftp):\/\/|\/\/|\/)[^\s<>"'`]+/gi, stripUrl);
  };

  const normalizeKey = (key) => key.toLowerCase().replace(/[^a-z\d]/g, '');
  const isPrivateKey = (key) =>
    /token|password|secret|authorization|cookie|apikey|csrf|sessionid|header/.test(key) ||
    /(?:querystring|query|fragment)$/.test(key) ||
    ['email', 'ipaddress', 'dbstatement', 'dbquerytext'].includes(key);

  /**
   * Clone SDK diagnostic objects; never mutate application/breadcrumb state.
   * This minimises known diagnostic fields, not arbitrary personal data in prose.
   */
  const sanitizeDiagnosticData = (input) => {
    const ancestors = new WeakSet();
    const visit = (value, key = '', depth = 0, budget = { remaining: 1000 }) => {
      if (--budget.remaining < 0 || depth >= 10) return '[Filtered]';
      if (typeof value === 'string') return cleanString(value, key);
      if (value === null || typeof value !== 'object') return value;
      if (ancestors.has(value)) return '[Filtered]';
      if (value instanceof Error) {
        const message = Object.getOwnPropertyDescriptor(value, 'message')?.value;
        const name =
          Object.getOwnPropertyDescriptor(value, 'name')?.value ||
          Object.getOwnPropertyDescriptor(Object.getPrototypeOf(value), 'name')?.value;
        return {
          name: typeof name === 'string' ? cleanString(name, '') : 'Error',
          message: typeof message === 'string' ? cleanString(message, '') : '[Filtered]',
        };
      }
      if (value instanceof Date) {
        return Number.isFinite(Date.prototype.getTime.call(value))
          ? Date.prototype.toISOString.call(value)
          : '[Invalid Date]';
      }
      const prototype = Object.getPrototypeOf(value);
      if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null)
        return '[Object]';
      ancestors.add(value);
      const entries = [];
      const array = Array.isArray(value);
      for (const name of Object.keys(value)) {
        if (--budget.remaining < 0) {
          entries.push(['__truncated__', '[Filtered]']);
          break;
        }
        const normalized = normalizeKey(name);
        if (isPrivateKey(normalized) || (key === 'request' && normalized === 'data')) continue;
        const descriptor = Object.getOwnPropertyDescriptor(value, name);
        // A large breadcrumb/span collection must not consume the event's type,
        // release or SDK metadata budget. Bound each free-form subtree instead.
        const childBudget =
          depth === 0 || (array && depth === 1 && ['breadcrumbs', 'spans'].includes(key))
            ? { remaining: 1000 }
            : budget;
        entries.push([
          name,
          descriptor && 'value' in descriptor
            ? visit(descriptor.value, array ? key : normalized, depth + 1, childBudget)
            : '[Filtered]',
        ]);
      }
      const result = array ? entries.map((entry) => entry[1]) : Object.fromEntries(entries);
      // DB commands may contain JWT-bearing Redis keys or user-supplied SQL.
      if (
        !array &&
        ((typeof result.op === 'string' && /^db(?:\.|$)/.test(result.op)) ||
          result.data?.['db.system'] ||
          result.attributes?.['db.system'])
      ) {
        for (const field of ['description', 'name', 'transaction']) {
          if (typeof result[field] === 'string') result[field] = '[Filtered database operation]';
        }
      }
      ancestors.delete(value);
      return result;
    };
    return visit(input);
  };

  return { sanitizeDiagnosticData };
});

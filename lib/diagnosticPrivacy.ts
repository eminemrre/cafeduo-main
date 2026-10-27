// Same CommonJS/browser bridge as lib/turkishText.ts: one implementation in both runtimes.
import '../shared/diagnosticPrivacy';
import type * as DiagnosticPrivacy from '../shared/diagnosticPrivacy';

const api = (
  globalThis as typeof globalThis & {
    __CAFEDUO_DIAGNOSTIC_PRIVACY__?: typeof DiagnosticPrivacy;
  }
).__CAFEDUO_DIAGNOSTIC_PRIVACY__;

if (!api) throw new Error('Diagnostic privacy module failed to initialize.');

export const sanitizeDiagnosticData = api.sanitizeDiagnosticData;

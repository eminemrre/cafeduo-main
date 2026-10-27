import { LEGAL_VERSION } from './seller';

it('uses the same legal version for the displayed terms and the server acceptance contract', () => {
  expect(require('../../backend/config/legal').LEGAL_VERSION).toBe(LEGAL_VERSION);
});

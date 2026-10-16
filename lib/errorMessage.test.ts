import { toErrorMessage } from './errorMessage';

describe('toErrorMessage', () => {
  it('uses the message of an Error', () => {
    expect(toErrorMessage(new Error('Kupon süresi dolmuş.'), 'fallback')).toBe(
      'Kupon süresi dolmuş.'
    );
  });

  it('falls back when an Error has no message', () => {
    expect(toErrorMessage(new Error(''), 'Kupon kullanılamadı.')).toBe('Kupon kullanılamadı.');
  });

  it('reads a server error from a response-shaped object', () => {
    expect(toErrorMessage({ response: { data: { error: 'Yetkisiz işlem.' } } }, 'fallback')).toBe(
      'Yetkisiz işlem.'
    );
  });

  it('ignores blank or non-string server errors', () => {
    expect(toErrorMessage({ response: { data: { error: '   ' } } }, 'fallback')).toBe('fallback');
    expect(toErrorMessage({ response: { data: { error: 42 } } }, 'fallback')).toBe('fallback');
  });

  it('falls back for values that carry no message', () => {
    // A geolocation rejection is a plain object with a code, not an Error.
    expect(toErrorMessage({ code: 1, message: 'User denied' }, 'Konum alınamadı.')).toBe(
      'Konum alınamadı.'
    );
    expect(toErrorMessage(null, 'fallback')).toBe('fallback');
    expect(toErrorMessage('boom', 'fallback')).toBe('fallback');
  });
});

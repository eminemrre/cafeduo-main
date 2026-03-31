import { safeReload, safeGoHome, safeReplace } from './navigation';

describe('navigation', () => {
  describe('safeReload', () => {
    it('calls location.reload() on the provided target', () => {
      const mockLocation = { reload: jest.fn() };
      safeReload(mockLocation);
      expect(mockLocation.reload).toHaveBeenCalledTimes(1);
    });

    it('does not throw when reload throws', () => {
      const mockLocation = {
        reload: jest.fn(() => { throw new Error('Reload failed'); }),
      };
      expect(() => safeReload(mockLocation)).not.toThrow();
      expect(mockLocation.reload).toHaveBeenCalledTimes(1);
    });
  });

  describe('safeGoHome', () => {
    it('sets location.href to "/" on the provided target', () => {
      const mockLocation = { href: '/dashboard' };
      safeGoHome(mockLocation);
      expect(mockLocation.href).toBe('/');
    });

    it('does not throw when setting href throws', () => {
      const mockLocation = new Proxy(
        { href: '' },
        {
          set(_target, prop, _value) {
            if (prop === 'href') throw new Error('Set href failed');
            return true;
          },
        }
      );
      expect(() => safeGoHome(mockLocation)).not.toThrow();
    });
  });

  describe('safeReplace', () => {
    it('calls location.replace() with the given url', () => {
      const mockLocation = { replace: jest.fn() };
      safeReplace('/test-url', mockLocation);
      expect(mockLocation.replace).toHaveBeenCalledWith('/test-url');
    });

    it('passes different urls correctly', () => {
      const mockLocation = { replace: jest.fn() };
      safeReplace('/other-path', mockLocation);
      expect(mockLocation.replace).toHaveBeenCalledWith('/other-path');
    });

    it('does not throw when replace throws', () => {
      const mockLocation = {
        replace: jest.fn(() => { throw new Error('Replace failed'); }),
      };
      expect(() => safeReplace('/test-url', mockLocation)).not.toThrow();
      expect(mockLocation.replace).toHaveBeenCalledWith('/test-url');
    });
  });
});

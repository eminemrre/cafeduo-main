import { safeGoHome, safeReload, safeReplace } from './navigation';

type MockLocation = {
  href: string;
  reload: jest.Mock;
  replace: jest.Mock;
};

const createLocation = (overrides: Partial<MockLocation> = {}): MockLocation => ({
  href: 'http://localhost/',
  reload: jest.fn(),
  replace: jest.fn(),
  ...overrides,
});

describe('navigation helpers', () => {
  it('reloads safely when location reload is available', () => {
    const location = createLocation();

    safeReload(location);

    expect(location.reload).toHaveBeenCalledTimes(1);
  });

  it('swallows reload errors', () => {
    const location = createLocation({
      reload: jest.fn(() => {
        throw new Error('reload failed');
      }),
    });

    expect(() => safeReload(location)).not.toThrow();
  });

  it('updates href safely for go-home navigation', () => {
    const location = createLocation({ href: 'http://localhost/dashboard' });

    safeGoHome(location);

    expect(location.href).toBe('/');
  });

  it('swallows href assignment errors', () => {
    const location = {
      get href() {
        return 'http://localhost/dashboard';
      },
      set href(_value: string) {
        throw new Error('href blocked');
      },
    } as Pick<Location, 'href'>;

    expect(() => safeGoHome(location)).not.toThrow();
  });

  it('replaces the current url safely', () => {
    const location = createLocation();

    safeReplace('/dashboard', location);

    expect(location.replace).toHaveBeenCalledWith('/dashboard');
  });

  it('swallows replace errors', () => {
    const location = createLocation({
      replace: jest.fn(() => {
        throw new Error('replace failed');
      }),
    });

    expect(() => safeReplace('/dashboard', location)).not.toThrow();
  });
});

const cache = require('../src/services/auth-cache.service');

describe('auth-cache.service', () => {
  beforeEach(() => cache.clear());
  afterEach(() => jest.useRealTimers());

  test('set then get returns the same payload within the TTL', () => {
    const payload = { id_usuario: 1, email: 'a@b.com', rol: 'admin', permisos: ['ventas:leer'] };
    cache.set('uid-1', payload);
    expect(cache.get('uid-1')).toEqual(payload);
  });

  test('get returns null for an unknown uid', () => {
    expect(cache.get('nope')).toBeNull();
  });

  test('get returns null once the TTL has elapsed', () => {
    jest.useFakeTimers();
    cache.set('uid-1', { rol: 'asesor' }, 1000);
    jest.advanceTimersByTime(999);
    expect(cache.get('uid-1')).not.toBeNull();
    jest.advanceTimersByTime(2);
    expect(cache.get('uid-1')).toBeNull();
  });

  test('invalidate removes only the targeted uid', () => {
    cache.set('uid-1', { rol: 'admin' });
    cache.set('uid-2', { rol: 'asesor' });
    cache.invalidate('uid-1');
    expect(cache.get('uid-1')).toBeNull();
    expect(cache.get('uid-2')).not.toBeNull();
  });

  test('clear empties the whole cache', () => {
    cache.set('uid-1', { rol: 'admin' });
    cache.set('uid-2', { rol: 'asesor' });
    cache.clear();
    expect(cache.get('uid-1')).toBeNull();
    expect(cache.get('uid-2')).toBeNull();
  });
});

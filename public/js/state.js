(function () {
  let _user    = null;
  let _can     = new Set();
  let _vistas  = new Set();

  window.AppState = {
    init(profile) {
      _user   = profile;
      _can    = new Set(profile.can    || []);
      _vistas = new Set(profile.vistas || []);
    },

    // Called by the role switcher to simulate another role's full permission set
    simulate(vistas, can) {
      _vistas = new Set(vistas || []);
      _can    = new Set(can    || []);
      if (_user) _user.vistas = vistas;
    },

    // Restore admin's original state after switching back
    restore(profile) {
      _can    = new Set(profile.can    || []);
      _vistas = new Set(profile.vistas || []);
      if (_user) _user.vistas = profile.vistas;
    },

    getUser()              { return _user; },
    can(resource, action)  { return _can.has(`${resource}:${action}`); },
    hasVista(key)          { return _vistas.has(key); },
  };
})();

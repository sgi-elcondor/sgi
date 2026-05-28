window.personalView = async function () {
  const vc = document.getElementById("viewContainer");
  vc.innerHTML = UI.loader();

  try {
    const [usuarios, comisiones, compradores, comisionistas] = await Promise.all([
      API.get("/usuarios").catch(() => []),
      API.get("/reportes/comisiones").catch(() => null),
      API.get("/compradores").catch(() => []),
      API.get("/comisionistas").catch(() => []),
    ]);

    const ROL_META = {
      comprador:         { icon: "user",       label: "Compradores",       color: "var(--primary)"    },
      asesor:            { icon: "handshake",  label: "Asesores",          color: "var(--success)"    },
      asesor_comercial:  { icon: "handshake",  label: "Asesores",          color: "var(--success)"    },
      auxiliar_contable: { icon: "book-open",  label: "Aux. Contables",    color: "var(--warning)"    },
      gerencia:          { icon: "crown",      label: "Gerencia",          color: "var(--primary)"    },
      juridico:          { icon: "scale",      label: "Jurídico",          color: "var(--danger)"     },
      comisionista:      { icon: "percent",    label: "Comisionistas",     color: "var(--warning)"    },
      admin:             { icon: "shield",     label: "Administradores",   color: "var(--text-muted)" },
      auditoria:         { icon: "eye",        label: "Auditoria",         color: "var(--text-muted)" },
    };

    const rolConteo = {};
    usuarios.filter(u => u.activo !== false).forEach(u => {
      const rol = u.roles?.nombre || "sin_rol";
      rolConteo[rol] = (rolConteo[rol] || 0) + 1;
    });

    const totalActivos   = usuarios.filter(u => u.activo !== false).length;
    const totalInactivos = usuarios.filter(u => u.activo === false).length;

    const comisionesPendientes = comisiones
      ? Number(comisiones.total_comisiones_pendientes ?? comisiones.pendiente ?? comisiones.saldo_pendiente ?? 0)
      : 0;

    const canVerUsuarios      = AppState.hasVista("usuarios");
    const canVerComisionistas = AppState.hasVista("comisionistas");
    const canVerCompradores   = AppState.hasVista("compradores");

    const rolesOrdenados = Object.entries(rolConteo).sort((a, b) => b[1] - a[1]);

    vc.innerHTML = `
      <section class="page-shell">
        <header class="rep-header">
          <div>
            <h2 class="rep-title">Personal registrado</h2>
            <p class="rep-sub">Distribucion de usuarios activos por rol en la plataforma</p>
          </div>
          <div style="display:flex;gap:.75rem;flex-wrap:wrap">
            <div class="per-stat-pill">
              <i data-lucide="users" style="width:14px;height:14px"></i>
              <strong>${totalActivos}</strong> activos
            </div>
            ${totalInactivos > 0 ? `
            <div class="per-stat-pill per-stat-pill--muted">
              <i data-lucide="user-x" style="width:14px;height:14px"></i>
              <strong>${totalInactivos}</strong> inactivos
            </div>` : ""}
          </div>
        </header>

        <div class="rep-section-label">Por rol</div>
        <div class="per-rol-grid">
          ${rolesOrdenados.map(([rol, count]) => {
            const meta = ROL_META[rol] || { icon: "user-cog", label: rol.replace(/_/g, " "), color: "var(--text-muted)" };
            const esComisionista = rol === "comisionista";
            const esComprador    = rol === "comprador";
            const navTarget      = esComprador ? "compradores" : esComisionista ? "comisionistas" : canVerUsuarios ? "usuarios" : null;
            const canNav         = navTarget && AppState.hasVista(navTarget);
            const pct            = totalActivos > 0 ? Math.round((count / totalActivos) * 100) : 0;
            return `
              <article class="per-rol-card${canNav ? " rep-proy-card--link" : ""}" ${canNav ? `onclick="window.navigate('${navTarget}')"` : ""}>
                <div class="per-rol-top">
                  <div class="per-rol-icon" style="color:${meta.color};background:${meta.color}1a">
                    <i data-lucide="${meta.icon}"></i>
                  </div>
                  <span class="per-rol-count" style="color:${meta.color}">${count}</span>
                </div>
                <div class="per-rol-label">${meta.label}</div>
                <div class="per-rol-bar-wrap">
                  <div class="per-rol-bar" style="width:${pct}%;background:${meta.color}"></div>
                </div>
                <div class="per-rol-pct">${pct}% del total</div>
                ${esComisionista && comisionesPendientes > 0
                  ? `<div class="rep-personal-sub" style="color:var(--warning);font-size:.72rem;margin-top:.2rem">${UI.fmt(comisionesPendientes)} pendiente</div>`
                  : ""}
                ${canNav ? '<div class="rep-kpi-hint" style="margin-top:.4rem"><i data-lucide="arrow-right" style="width:11px;height:11px"></i> Ver más</div>' : ""}
              </article>`;
          }).join("")}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:.5rem">
          <div class="table-wrap">
            <div class="table-header">
              <h3>Compradores <span style="font-weight:400;color:var(--text-muted)">(${compradores.length})</span></h3>
              ${canVerCompradores ? `<button class="btn btn-ghost btn-sm" onclick="window.navigate('compradores')">Ver todos</button>` : ""}
            </div>
            <table>
              <thead><tr><th>Nombre</th><th>Documento</th><th>Telefono</th></tr></thead>
              <tbody>
                ${compradores.slice(0, 6).map(c => `
                  <tr>
                    <td>${c.nombres ?? ""} ${c.apellidos ?? ""}</td>
                    <td style="font-size:.82rem">${c.documento ?? "—"}</td>
                    <td style="font-size:.82rem">${c.telefono ?? "—"}</td>
                  </tr>`).join("")}
                ${compradores.length > 6 ? `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);font-size:.8rem;padding:8px">+${compradores.length - 6} más</td></tr>` : ""}
              </tbody>
            </table>
          </div>

          <div class="table-wrap">
            <div class="table-header">
              <h3>Comisionistas <span style="font-weight:400;color:var(--text-muted)">(${comisionistas.length})</span></h3>
              ${canVerComisionistas ? `<button class="btn btn-ghost btn-sm" onclick="window.navigate('comisionistas')">Ver todos</button>` : ""}
            </div>
            <table>
              <thead><tr><th>Nombre</th><th>Documento</th><th>Telefono</th></tr></thead>
              <tbody>
                ${comisionistas.slice(0, 6).map(c => `
                  <tr>
                    <td>${c.nombres ?? ""} ${c.apellidos ?? ""}</td>
                    <td style="font-size:.82rem">${c.documento ?? "—"}</td>
                    <td style="font-size:.82rem">${c.telefono ?? "—"}</td>
                  </tr>`).join("")}
                ${comisionistas.length > 6 ? `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);font-size:.8rem;padding:8px">+${comisionistas.length - 6} más</td></tr>` : ""}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    `;

    window.SGIUI?.hydrate();

  } catch (e) {
    vc.innerHTML = `<p style="color:var(--danger);padding:20px">${e.message}</p>`;
  }
};

(() => {
  const s = document.createElement("style");
  s.textContent = `
    .per-stat-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: .35rem .75rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--surface);
      font-size: .8rem;
      color: var(--text);
    }
    .per-stat-pill--muted { color: var(--text-muted); }
    .per-rol-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: .875rem;
      margin-bottom: 2rem;
    }
    .per-rol-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1rem 1.1rem;
    }
    .per-rol-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: .5rem;
    }
    .per-rol-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
    }
    .per-rol-icon svg { width: 16px; height: 16px; }
    .per-rol-count {
      font-size: 1.8rem;
      font-weight: 800;
      line-height: 1;
    }
    .per-rol-label {
      font-size: .75rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: .04em;
      margin-bottom: .5rem;
    }
    .per-rol-bar-wrap {
      height: 4px;
      background: var(--border);
      border-radius: 2px;
      margin-bottom: .3rem;
    }
    .per-rol-bar {
      height: 100%;
      border-radius: 2px;
      transition: width .4s ease;
    }
    .per-rol-pct {
      font-size: .7rem;
      color: var(--text-muted);
    }
  `;
  document.head.appendChild(s);
})();

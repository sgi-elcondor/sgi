const API = '/api/productos'

async function cargarProductos() {
  const buscar    = document.getElementById('buscar').value
  const categoria = document.getElementById('filtro-categoria').value
  const params = new URLSearchParams()
  if (buscar)    params.set('buscar', buscar)
  if (categoria) params.set('categoria', categoria)
  const res  = await fetch(`${API}?${params}`)
  const json = await res.json()
  renderTabla(json.productos)
  actualizarCategorias(json.productos)
}

function renderTabla(productos) {
  const tbody = document.getElementById('tbody')
  const sinRes = document.getElementById('sin-resultados')
  if (!productos.length) {
    tbody.innerHTML = ''
    sinRes.style.display = 'block'
    return
  }
  sinRes.style.display = 'none'
  tbody.innerHTML = productos.map(p => `
    <tr>
      <td>
        <strong>${p.nombre}</strong>
        ${p.descripcion ? `<br><span style="color:#888;font-size:12px">${p.descripcion}</span>` : ''}
      </td>
      <td>${p.categoria ? `<span class="badge">${p.categoria}</span>` : '—'}</td>
      <td>$${Number(p.precio).toLocaleString('es-CO')}</td>
      <td class="${p.stock < 5 ? 'stock-bajo' : ''}">${p.stock} uds${p.stock < 5 ? ' ⚠' : ''}</td>
      <td>
        <div class="acciones">
          <button class="btn-editar" onclick="abrirEditar(${p.id})">Editar</button>
          <button class="btn-eliminar" onclick="eliminar(${p.id}, '${p.nombre}')">Eliminar</button>
        </div>
      </td>
    </tr>
  `).join('')
}

function actualizarCategorias(productos) {
  const select = document.getElementById('filtro-categoria')
  const actual = select.value
  const cats   = [...new Set(productos.map(p => p.categoria).filter(Boolean))]
  select.innerHTML = '<option value="">Todas las categorías</option>'
  cats.forEach(c => {
    const opt = document.createElement('option')
    opt.value = c; opt.textContent = c
    if (c === actual) opt.selected = true
    select.appendChild(opt)
  })
}

function abrirModal(producto = null) {
  document.getElementById('modal-titulo').textContent = producto ? 'Editar producto' : 'Nuevo producto'
  document.getElementById('producto-id').value  = producto?.id    || ''
  document.getElementById('nombre').value       = producto?.nombre      || ''
  document.getElementById('descripcion').value  = producto?.descripcion || ''
  document.getElementById('precio').value       = producto?.precio      || ''
  document.getElementById('stock').value        = producto?.stock       ?? 0
  document.getElementById('categoria').value    = producto?.categoria   || ''
  document.getElementById('modal-overlay').style.display = 'flex'
}

function cerrarModal() {
  document.getElementById('modal-overlay').style.display = 'none'
}

async function abrirEditar(id) {
  const res = await fetch(`${API}/${id}`)
  const p   = await res.json()
  abrirModal(p)
}

document.getElementById('form-producto').addEventListener('submit', async (e) => {
  e.preventDefault()
  const id = document.getElementById('producto-id').value
  const body = {
    nombre:      document.getElementById('nombre').value,
    descripcion: document.getElementById('descripcion').value,
    precio:      Number(document.getElementById('precio').value),
    stock:       Number(document.getElementById('stock').value),
    categoria:   document.getElementById('categoria').value
  }
  const url    = id ? `${API}/${id}` : API
  const metodo = id ? 'PUT' : 'POST'

  const res = await fetch(url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (res.ok) { cerrarModal(); cargarProductos() }
  else {
    const err = await res.json()
    alert('Error: ' + err.mensaje)
  }
})
async function eliminar(id, nombre) {
  if (!confirm(`¿Eliminar "${nombre}"?`)) return
  await fetch(`${API}/${id}`, { method: 'DELETE' })
  cargarProductos() 
}
document.getElementById('buscar').addEventListener('input', cargarProductos)
document.getElementById('filtro-categoria').addEventListener('change', cargarProductos)
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'modal-overlay') cerrarModal()
})

cargarProductos()
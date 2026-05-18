/**
 * AvatarCropper — modal to select, crop and upload a square profile photo.
 * Requires CropperJS loaded globally (window.Cropper).
 * Usage: AvatarCropper.open({ onSuccess(url){} })
 */
const AvatarCropper = (function () {

  function open({ onSuccess }) {
    _cleanup();

    const overlay = document.createElement('div');
    overlay.id = 'avatar-cropper-overlay';
    overlay.innerHTML = `
      <div class="ac-modal">
        <div class="ac-header">
          <span class="ac-title">Ajusta tu foto de perfil</span>
          <button class="ac-close" id="ac-close-btn" aria-label="Cerrar"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div class="ac-crop-area">
          <img id="ac-img" src="" alt="preview" />
        </div>
        <div class="ac-hint">Arrastra y ajusta el recuadro para seleccionar el área que quieres conservar</div>
        <div class="ac-actions">
          <label class="ac-btn ac-btn-ghost" id="ac-change-label">
            <input type="file" id="ac-file-input" accept="image/jpeg,image/png,image/webp" style="display:none" />
            Cambiar imagen
          </label>
          <button class="ac-btn ac-btn-primary" id="ac-confirm-btn">Guardar foto</button>
        </div>
        <div class="ac-error" id="ac-error" style="display:none"></div>
      </div>`;

    document.body.appendChild(overlay);

    const fileInput = document.getElementById('ac-file-input');
    fileInput.addEventListener('change', _handleFileChange);
    document.getElementById('ac-close-btn').addEventListener('click', _cleanup);
    document.getElementById('ac-confirm-btn').addEventListener('click', function () { _upload(onSuccess); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) _cleanup(); });

    fileInput.click();
  }

  let _cropperInstance = null;

  function _handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      _showError('Formato no permitido. Use JPG, PNG o WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      _showError('La imagen supera el límite de 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = function (ev) {
      const img = document.getElementById('ac-img');
      img.src = ev.target.result;

      if (_cropperInstance) { _cropperInstance.destroy(); _cropperInstance = null; }

      _cropperInstance = new window.Cropper(img, {
        aspectRatio:     1,
        viewMode:        1,
        dragMode:        'move',
        autoCropArea:    0.85,
        responsive:      true,
        restore:         false,
        guides:          true,
        center:          true,
        highlight:       false,
        cropBoxMovable:  true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false,
      });
    };
    reader.readAsDataURL(file);
  }

  async function _upload(onSuccess) {
    if (!_cropperInstance) { _showError('Selecciona una imagen primero.'); return; }

    const btn = document.getElementById('ac-confirm-btn');
    btn.disabled = true;
    btn.textContent = 'Subiendo...';
    _showError('', false);

    _cropperInstance.getCroppedCanvas({ width: 400, height: 400, imageSmoothingQuality: 'high' })
      .toBlob(async function (blob) {
        if (!blob) { _showError('No se pudo procesar la imagen.'); btn.disabled = false; btn.textContent = 'Guardar foto'; return; }

        const form = new FormData();
        form.append('avatar', blob, 'avatar.webp');

        try {
          const token = localStorage.getItem('fb_token');
          const res = await fetch('/api/uploads/avatar', {
            method:  'POST',
            headers: token ? { Authorization: 'Bearer ' + token } : {},
            body:    form,
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'Error al subir');

          await fetch('/api/auth/avatar', {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
            body:    JSON.stringify({ photo_url: json.url }),
          });

          _cleanup();
          if (onSuccess) onSuccess(json.url);
        } catch (err) {
          _showError(err.message || 'Error al subir la imagen.');
          btn.disabled = false;
          btn.textContent = 'Guardar foto';
        }
      }, 'image/webp', 0.9);
  }

  function _showError(msg, show = true) {
    const el = document.getElementById('ac-error');
    if (!el) return;
    el.textContent = msg;
    el.style.display = show ? 'block' : 'none';
  }

  function _cleanup() {
    if (_cropperInstance) { _cropperInstance.destroy(); _cropperInstance = null; }
    const el = document.getElementById('avatar-cropper-overlay');
    if (el) el.remove();
  }

  return { open };
})();

const nodemailer = require('nodemailer');

// Gmail SMTP from a PaaS (Railway) can hang or be blocked on one egress port while the
// other works. Two transports are kept — STARTTLS on 587 and implicit TLS on 465 — and
// every send tries the primary first and retries once over the alternate on connection
// failures. Short timeouts guarantee a blocked port fails in seconds instead of holding
// the caller for the nodemailer defaults (minutes).
const SMTP_TIMEOUTS = {
  connectionTimeout: 10000,
  greetingTimeout:   10000,
  socketTimeout:     20000,
};

function crearTransporte(port) {
  return nodemailer.createTransport({
    host:   'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    ...SMTP_TIMEOUTS,
  });
}

const PUERTO_PRIMARIO = Number(process.env.SMTP_PORT) || 587;
const PUERTO_ALTERNO  = PUERTO_PRIMARIO === 465 ? 587 : 465;

const transportePrimario = crearTransporte(PUERTO_PRIMARIO);
const transporteAlterno  = crearTransporte(PUERTO_ALTERNO);

async function _send(mail) {
  try {
    const info = await transportePrimario.sendMail(mail);
    console.log(`[email] enviado a ${mail.to} (puerto ${PUERTO_PRIMARIO}): ${mail.subject}`);
    return info;
  } catch (e1) {
    console.error(`[email] fallo puerto ${PUERTO_PRIMARIO} (${e1.code || e1.message}) — reintentando por ${PUERTO_ALTERNO}`);
    try {
      const info = await transporteAlterno.sendMail(mail);
      console.log(`[email] enviado a ${mail.to} (puerto ${PUERTO_ALTERNO}): ${mail.subject}`);
      return info;
    } catch (e2) {
      console.error(`[email] fallo definitivo a ${mail.to}: ${e2.code || ''} ${e2.message}`);
      throw e2;
    }
  }
}

// Escapes values interpolated into the HTML email bodies. The data is internal (DB / Firebase),
// but escaping keeps a stray '<', '&' or quote in a name/proyecto/lote from corrupting the markup.
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

async function sendPasswordResetEmail(to, resetLink) {
  await _send({
    from:    `"El Cóndor · SGI" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Restablece tu contraseña — El Cóndor',
    html: `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0ea;padding:40px 16px;">
  <tr>
    <td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#f97316,#ea6010);padding:28px 32px;text-align:center;">
            <p style="margin:0 0 10px;font-size:28px;">&#128273;</p>
            <h1 style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:20px;font-weight:700;color:#ffffff;">Restablecer contraseña</h1>
            <p style="margin:6px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:rgba(255,255,255,0.82);">El Cóndor · Sistema de Gestión Inmobiliaria</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 8px;">
            <p style="margin:0 0 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#333333;">Hola,</p>
            <p style="margin:0 0 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#333333;">Recibimos una solicitud para restablecer la contraseña de <strong style="color:#111111;">${esc(to)}</strong>. Haz clic en el botón para crear una nueva.</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:28px;">
                  <a href="${resetLink}" style="display:inline-block;padding:14px 40px;background:#f97316;color:#ffffff;text-decoration:none;border-radius:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:700;">Restablecer contraseña</a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.55;color:#999999;">Este enlace es válido por <strong style="color:#666;">1 hora</strong>. Si no solicitaste este cambio, ignora este correo — tu contraseña no será modificada.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 24px;border-top:1px solid #f0ebe4;">
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#bbbbbb;text-align:center;line-height:1.6;">Correo enviado automáticamente por <strong>El Cóndor SGI</strong>.<br>Por favor, no respondas a este mensaje.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`,
  });
}

function _fmtMoney(n) {
  const v = Math.round(Number(n) || 0);
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

async function sendCompraConfirmacionEmail(to, datos) {
  const {
    nombres,
    codigo_venta,
    proyecto,
    codigo_lote,
    valor_total,
    cuota_inicial,
    total_cuotas,
  } = datos;

  const appUrl   = process.env.APP_URL || 'https://sgi.somoselcondor.com';
  const portal   = `${appUrl.replace(/\/+$/, '')}/#mis-cuotas`;
  const saludo   = nombres ? `Hola ${esc(String(nombres).split(' ')[0])},` : 'Hola,';
  const valorFmt = `$ ${_fmtMoney(valor_total)}`;
  const ciFmt    = cuota_inicial ? `$ ${_fmtMoney(cuota_inicial)}` : '—';
  const codigoV  = esc(codigo_venta || '—');
  const proyectoTxt = esc(proyecto || '—');
  const loteTxt  = esc(codigo_lote || '—');
  const cuotasTxt = total_cuotas ? `${total_cuotas} cuotas` : 'plan de pago disponible';

  await _send({
    from:    `"El Cóndor · SGI" <${process.env.SMTP_USER}>`,
    to,
    subject: '¡Compra confirmada! Tu cuenta ahora es de comprador — El Cóndor',
    html: `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0ea;padding:40px 16px;">
  <tr>
    <td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#f97316,#ea6010);padding:28px 32px;text-align:center;">
            <p style="margin:0 0 10px;font-size:28px;">&#127969;</p>
            <h1 style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:20px;font-weight:700;color:#ffffff;">¡Bienvenido como comprador!</h1>
            <p style="margin:6px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:rgba(255,255,255,0.82);">El Cóndor · Sistema de Gestión Inmobiliaria</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 12px;">
            <p style="margin:0 0 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#333333;">${saludo}</p>
            <p style="margin:0 0 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#333333;">Tu compra quedó registrada en SGI El Cóndor. A partir de ahora tu cuenta tiene rol de <strong>comprador</strong> y puedes acceder a la información de tu lote, tus cuotas, tus facturas y tus recibos sin trámite adicional.</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1px solid #f0ebe4;border-radius:12px;margin:8px 0 24px;">
              <tr>
                <td style="padding:14px 18px;border-bottom:1px solid #f0ebe4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#666;">Código de venta</td>
                <td style="padding:14px 18px;border-bottom:1px solid #f0ebe4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#111;text-align:right;font-weight:600;">${codigoV}</td>
              </tr>
              <tr>
                <td style="padding:14px 18px;border-bottom:1px solid #f0ebe4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#666;">Proyecto</td>
                <td style="padding:14px 18px;border-bottom:1px solid #f0ebe4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#111;text-align:right;">${proyectoTxt}</td>
              </tr>
              <tr>
                <td style="padding:14px 18px;border-bottom:1px solid #f0ebe4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#666;">Lote</td>
                <td style="padding:14px 18px;border-bottom:1px solid #f0ebe4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#111;text-align:right;">${loteTxt}</td>
              </tr>
              <tr>
                <td style="padding:14px 18px;border-bottom:1px solid #f0ebe4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#666;">Valor total</td>
                <td style="padding:14px 18px;border-bottom:1px solid #f0ebe4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#111;text-align:right;font-weight:600;">${valorFmt}</td>
              </tr>
              <tr>
                <td style="padding:14px 18px;border-bottom:1px solid #f0ebe4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#666;">Cuota inicial</td>
                <td style="padding:14px 18px;border-bottom:1px solid #f0ebe4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#111;text-align:right;">${ciFmt}</td>
              </tr>
              <tr>
                <td style="padding:14px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#666;">Plan de pago</td>
                <td style="padding:14px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#111;text-align:right;">${cuotasTxt}</td>
              </tr>
            </table>

            <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:700;color:#111;">Tus nuevos accesos</p>
            <ul style="margin:0 0 24px;padding-left:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.7;color:#333;">
              <li>Mis cuotas — fechas, valores y estado.</li>
              <li>Mis facturas — facturas emitidas pendientes de pago.</li>
              <li>Mis pagos — historial y comprobantes.</li>
              <li>Mis recibos — recibos asociados a cada pago aceptado.</li>
              <li>El catálogo del proyecto sigue disponible.</li>
            </ul>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:24px;">
                  <a href="${portal}" style="display:inline-block;padding:14px 36px;background:#f97316;color:#ffffff;text-decoration:none;border-radius:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:700;">Ir al portal del comprador</a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.55;color:#999;">Si tienes cualquier duda sobre tu compra o el plan de pagos, contacta a tu asesor.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 24px;border-top:1px solid #f0ebe4;">
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#bbbbbb;text-align:center;line-height:1.6;">Correo enviado automáticamente por <strong>El Cóndor SGI</strong>.<br>Por favor, no respondas a este mensaje.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`,
  });
}

const URGENCIA_STYLE = {
  baja:  { label: 'Baja',  color: '#6b7280', bg: '#f3f4f6' },
  media: { label: 'Media', color: '#2563eb', bg: '#eff6ff' },
  alta:  { label: 'Alta',  color: '#dc2626', bg: '#fef2f2' },
};

// Notifies a jefe de área that a new requerimiento awaits their review (REQ-01).
async function sendRequerimientoNuevoEmail(to, datos) {
  const { numero, solicitante, categoria, urgencia, valor_total, descripcion, items_count } = datos;
  const urg    = URGENCIA_STYLE[urgencia] || URGENCIA_STYLE.media;
  const portal = 'https://sgi.somoselcondor.com';

  await _send({
    from:    `"El Cóndor · SGI" <${process.env.SMTP_USER}>`,
    to,
    subject: `Nuevo requerimiento ${numero} pendiente de tu revisión — El Cóndor`,
    html: `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0ea;padding:40px 16px;">
  <tr>
    <td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#f97316,#ea6010);padding:28px 32px;text-align:center;">
            <p style="margin:0 0 10px;font-size:28px;">&#128203;</p>
            <h1 style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:20px;font-weight:700;color:#ffffff;">Nuevo requerimiento de materiales</h1>
            <p style="margin:6px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:rgba(255,255,255,0.82);">El Cóndor · Sistema de Gestión Inmobiliaria</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 8px;">
            <p style="margin:0 0 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#333333;"><strong style="color:#111111;">${solicitante}</strong> creó el requerimiento <strong style="color:#111111;">${numero}</strong> y está pendiente de tu revisión.</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2;border-radius:10px;margin-bottom:24px;">
              <tr><td style="padding:14px 18px 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#999;">Descripción</td></tr>
              <tr><td style="padding:0 18px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#333;font-weight:600;">${descripcion}</td></tr>
              <tr><td style="padding:0 18px 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#666;">
                Categoría: <strong style="color:#333;text-transform:capitalize;">${categoria}</strong> &nbsp;·&nbsp;
                Ítems: <strong style="color:#333;">${items_count}</strong> &nbsp;·&nbsp;
                Urgencia: <span style="display:inline-block;padding:2px 10px;border-radius:99px;background:${urg.bg};color:${urg.color};font-weight:700;font-size:12px;">${urg.label}</span>
              </td></tr>
              <tr><td style="padding:0 18px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#333;">Monto estimado: <strong style="color:#111;">$ ${_fmtMoney(valor_total)}</strong></td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:24px;">
                  <a href="${portal}" style="display:inline-block;padding:14px 36px;background:#f97316;color:#ffffff;text-decoration:none;border-radius:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:700;">Revisar en el SGI</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 24px;border-top:1px solid #f0ebe4;">
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#bbbbbb;text-align:center;line-height:1.6;">Correo enviado automáticamente por <strong>El Cóndor SGI</strong>.<br>Por favor, no respondas a este mensaje.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`,
  });
}

// Generic state-change notification for the requerimiento approval flow (REQ-02/03):
// used for "listo para aprobación final" (gerencia), "en tesorería" (tesorero),
// "aprobado" / "rechazado" (peticionario). `motivo` renders a red reason box.
async function sendRequerimientoEstadoEmail(to, datos) {
  const { asunto, titulo, mensaje, numero, valor_total, motivo } = datos;
  const portal = 'https://sgi.somoselcondor.com';

  const motivoHTML = motivo ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;margin-bottom:24px;">
      <tr><td style="padding:12px 18px 2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;font-weight:700;color:#dc2626;">MOTIVO</td></tr>
      <tr><td style="padding:0 18px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#7f1d1d;line-height:1.5;">${motivo}</td></tr>
    </table>` : '';

  await _send({
    from:    `"El Cóndor · SGI" <${process.env.SMTP_USER}>`,
    to,
    subject: asunto,
    html: `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0ea;padding:40px 16px;">
  <tr>
    <td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#f97316,#ea6010);padding:28px 32px;text-align:center;">
            <p style="margin:0 0 10px;font-size:28px;">&#128203;</p>
            <h1 style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:20px;font-weight:700;color:#ffffff;">${titulo}</h1>
            <p style="margin:6px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:rgba(255,255,255,0.82);">El Cóndor · Sistema de Gestión Inmobiliaria</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 8px;">
            <p style="margin:0 0 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#333333;">${mensaje}</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2;border-radius:10px;margin-bottom:24px;">
              <tr><td style="padding:14px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#333;">
                Requerimiento: <strong style="color:#111;">${numero}</strong>
                ${valor_total != null ? ` &nbsp;·&nbsp; Monto estimado: <strong style="color:#111;">$ ${_fmtMoney(valor_total)}</strong>` : ''}
              </td></tr>
            </table>
            ${motivoHTML}
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:24px;">
                  <a href="${portal}" style="display:inline-block;padding:14px 36px;background:#f97316;color:#ffffff;text-decoration:none;border-radius:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:700;">Revisar en el SGI</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 24px;border-top:1px solid #f0ebe4;">
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#bbbbbb;text-align:center;line-height:1.6;">Correo enviado automáticamente por <strong>El Cóndor SGI</strong>.<br>Por favor, no respondas a este mensaje.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`,
  });
}

// SEG-04: 6-digit login verification code for sensitive roles (admin, auxiliar_contable,
// gerencia). `esPrimeraConfiguracion` only changes the copy — the mechanism (send + verify
// a code) is identical for enrollment and for every later login.
async function sendLogin2FACodigo(to, { codigo, expiraMinutos, esPrimeraConfiguracion }) {
  const titulo = esPrimeraConfiguracion
    ? 'Activa la verificación en dos pasos'
    : 'Tu código de verificación';
  const intro = esPrimeraConfiguracion
    ? 'Tu cuenta tiene un rol con acceso a información sensible, así que a partir de ahora cada inicio de sesión te va a pedir este código adicional. Ingrésalo para activar la verificación en dos pasos y continuar.'
    : 'Ingresa este código para completar tu inicio de sesión.';

  await _send({
    from:    `"El Cóndor · SGI" <${process.env.SMTP_USER}>`,
    to,
    subject: esPrimeraConfiguracion ? 'Activa tu verificación en dos pasos — El Cóndor' : `Tu código de verificación es ${codigo} — El Cóndor`,
    html: `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0ea;padding:40px 16px;">
  <tr>
    <td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#f97316,#ea6010);padding:28px 32px;text-align:center;">
            <p style="margin:0 0 10px;font-size:28px;">&#128274;</p>
            <h1 style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:20px;font-weight:700;color:#ffffff;">${titulo}</h1>
            <p style="margin:6px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:rgba(255,255,255,0.82);">El Cóndor · Sistema de Gestión Inmobiliaria</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 8px;">
            <p style="margin:0 0 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#333333;">${intro}</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2;border-radius:12px;margin-bottom:16px;">
              <tr>
                <td align="center" style="padding:24px 18px;">
                  <span style="font-family:'Courier New',monospace;font-size:36px;font-weight:700;letter-spacing:10px;color:#111111;">${esc(codigo)}</span>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.55;color:#999999;">Este código es válido por <strong style="color:#666;">${expiraMinutos} minutos</strong> y solo se puede usar una vez.</p>
            <p style="margin:16px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.55;color:#dc2626;">Si no fuiste tú quien intentó iniciar sesión, cambia tu contraseña de inmediato desde "¿Olvidaste tu contraseña?" y avisa a la oficina.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 24px;border-top:1px solid #f0ebe4;">
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#bbbbbb;text-align:center;line-height:1.6;">Correo enviado automáticamente por <strong>El Cóndor SGI</strong>.<br>Por favor, no respondas a este mensaje.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`,
  });
}

// SEG-05: sent when a login is detected from an IP different from the last one on record.
// Applies to every role — cheap signal that costs nothing on a normal day and gives a user a
// chance to react if it wasn't them, even on roles that don't have 2FA (SEG-04).
async function sendNuevoLoginEmail(to, { ip, fecha, userAgent }) {
  await _send({
    from:    `"El Cóndor · SGI" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Nuevo inicio de sesión en tu cuenta — El Cóndor',
    html: `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0ea;padding:40px 16px;">
  <tr>
    <td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#f97316,#ea6010);padding:28px 32px;text-align:center;">
            <p style="margin:0 0 10px;font-size:28px;">&#128272;</p>
            <h1 style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:20px;font-weight:700;color:#ffffff;">Nuevo inicio de sesión</h1>
            <p style="margin:6px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:rgba(255,255,255,0.82);">El Cóndor · Sistema de Gestión Inmobiliaria</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 8px;">
            <p style="margin:0 0 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#333333;">Detectamos un inicio de sesión en tu cuenta desde una ubicación distinta a la habitual.</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2;border-radius:10px;margin-bottom:24px;">
              <tr>
                <td style="padding:14px 18px;border-bottom:1px solid #f0ebe4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#666;">Fecha</td>
                <td style="padding:14px 18px;border-bottom:1px solid #f0ebe4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#111;text-align:right;">${esc(fecha)}</td>
              </tr>
              <tr>
                <td style="padding:14px 18px;border-bottom:1px solid #f0ebe4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#666;">Dirección IP</td>
                <td style="padding:14px 18px;border-bottom:1px solid #f0ebe4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#111;text-align:right;">${esc(ip)}</td>
              </tr>
              <tr>
                <td style="padding:14px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#666;">Dispositivo</td>
                <td style="padding:14px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#111;text-align:right;">${esc((userAgent || '').slice(0, 90)) || '—'}</td>
              </tr>
            </table>
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.55;color:#dc2626;">Si fuiste tú, ignora este correo. Si no reconoces este acceso, cambia tu contraseña de inmediato desde "¿Olvidaste tu contraseña?" y avisa a la oficina.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 24px;border-top:1px solid #f0ebe4;">
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#bbbbbb;text-align:center;line-height:1.6;">Correo enviado automáticamente por <strong>El Cóndor SGI</strong>.<br>Por favor, no respondas a este mensaje.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`,
  });
}

// SEG-07 (step-up): re-proves the acting user's identity mid-session, right before a critical
// write (assigning the admin role, deactivating/reactivating an account). Reuses the same
// email-OTP mechanism as SEG-04 login, just with copy that names the specific action.
async function sendStepUpCodigo(to, { codigo, expiraMinutos, accion }) {
  await _send({
    from:    `"El Cóndor · SGI" <${process.env.SMTP_USER}>`,
    to,
    subject: `Confirma esta acción: ${codigo} — El Cóndor`,
    html: `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0ea;padding:40px 16px;">
  <tr>
    <td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#f97316,#ea6010);padding:28px 32px;text-align:center;">
            <p style="margin:0 0 10px;font-size:28px;">&#9888;&#65039;</p>
            <h1 style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:20px;font-weight:700;color:#ffffff;">Confirma esta acción</h1>
            <p style="margin:6px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:rgba(255,255,255,0.82);">El Cóndor · Sistema de Gestión Inmobiliaria</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 8px;">
            <p style="margin:0 0 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#333333;">Estás a punto de: <strong style="color:#111;">${esc(accion)}</strong>. Ingresa este código para confirmarlo.</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2;border-radius:12px;margin-bottom:16px;">
              <tr>
                <td align="center" style="padding:24px 18px;">
                  <span style="font-family:'Courier New',monospace;font-size:36px;font-weight:700;letter-spacing:10px;color:#111111;">${esc(codigo)}</span>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.55;color:#999999;">Este código es válido por <strong style="color:#666;">${expiraMinutos} minutos</strong> y solo se puede usar una vez.</p>
            <p style="margin:16px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.55;color:#dc2626;">Si no fuiste tú quien intentó esta acción, cambia tu contraseña de inmediato y avisa a la oficina.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 24px;border-top:1px solid #f0ebe4;">
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#bbbbbb;text-align:center;line-height:1.6;">Correo enviado automáticamente por <strong>El Cóndor SGI</strong>.<br>Por favor, no respondas a este mensaje.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`,
  });
}

module.exports = { sendPasswordResetEmail, sendCompraConfirmacionEmail, sendRequerimientoNuevoEmail, sendRequerimientoEstadoEmail, sendLogin2FACodigo, sendNuevoLoginEmail, sendStepUpCodigo };

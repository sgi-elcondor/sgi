const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   'smtp.gmail.com',
  port:   587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendPasswordResetEmail(to, resetLink) {
  await transporter.sendMail({
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
            <p style="margin:0 0 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#333333;">Recibimos una solicitud para restablecer la contraseña de <strong style="color:#111111;">${to}</strong>. Haz clic en el botón para crear una nueva.</p>
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
  const saludo   = nombres ? `Hola ${String(nombres).split(' ')[0]},` : 'Hola,';
  const valorFmt = `$ ${_fmtMoney(valor_total)}`;
  const ciFmt    = cuota_inicial ? `$ ${_fmtMoney(cuota_inicial)}` : '—';
  const codigoV  = codigo_venta || '—';
  const proyectoTxt = proyecto || '—';
  const loteTxt  = codigo_lote || '—';
  const cuotasTxt = total_cuotas ? `${total_cuotas} cuotas` : 'plan de pago disponible';

  await transporter.sendMail({
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

module.exports = { sendPasswordResetEmail, sendCompraConfirmacionEmail };

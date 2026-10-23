import { formatCop, formatDay } from '../../domain/common/format.js';
import { escapeHtml, htmlToPlainText } from '../../domain/common/text.js';

/** Subject plus HTML and plain-text bodies of an e-mail. */
export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const FONT = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const rendered = (subject: string, html: string): RenderedEmail => ({ subject, html, text: htmlToPlainText(html) });

/** Common layout of the school e-mails (legacy `email/compose.php:108-126`). */
const layout = (input: {
  title: string;
  schoolName: string;
  headerColor: string;
  content: string;
}): string => `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.title)}</title></head>
<body style="margin:0;padding:24px 0;background:#f1f5f9;font-family:${FONT}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto">
<tr><td style="background:linear-gradient(135deg,${input.headerColor},#7981f5);background-color:${input.headerColor};border-radius:16px 16px 0 0;padding:24px 30px">
<h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800">Apreu</h1>
<div style="color:#c7d2fe;font-size:12px">${escapeHtml(input.schoolName)}</div>
</td></tr>
<tr><td style="background:#ffffff;padding:30px">${input.content}</td></tr>
<tr><td style="background:#47557c;border-radius:0 0 16px 16px;padding:14px 30px;text-align:center;color:#94a3b8;font-size:11px">${escapeHtml(input.schoolName)} · Powered by Apreu ERP</td></tr>
</table>
</body></html>`;

/**
 * HTML e-mail templates. Every interpolated value is escaped (legacy bug
 * #28); only the notice body, already sanitized, is embedded as HTML.
 */
export const EmailTemplates = {
  /** Notice written in the editor (§3.1). `safeBodyHtml` must come from the HTML sanitizer. */
  notice(input: { subject: string; safeBodyHtml: string; schoolName: string; primaryColor: string }): RenderedEmail {
    const content = `<h2 style="margin:0 0 16px;color:#47557c;font-size:18px">${escapeHtml(input.subject)}</h2>
<div style="color:#334155;font-size:14px;line-height:1.7">${input.safeBodyHtml}</div>`;
    return rendered(
      input.subject,
      layout({ title: input.subject, schoolName: input.schoolName, headerColor: input.primaryColor, content }),
    );
  },

  /** Billing notice of a pending charge (§3.2, RN-COM-07). */
  billingNotice(input: {
    studentName: string;
    studentCode: string;
    conceptName: string | null;
    amount: number;
    dueDate: string;
    schoolName: string;
  }): RenderedEmail {
    const concept = input.conceptName || 'Mensualidad';
    const row = (label: string, value: string, style: string, shaded: boolean) =>
      `<tr${shaded ? ' style="background:#f8fafc"' : ''}><td style="padding:10px 14px;color:#64748b;font-size:13px">${label}</td><td style="padding:10px 14px;${style}">${value}</td></tr>`;
    const content = `<h2 style="margin:0 0 16px;color:#47557c;font-size:18px">Aviso de Cobro</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px">
${row('Alumno', escapeHtml(input.studentName), 'color:#47557c;font-weight:700', false)}
${row('Código', escapeHtml(input.studentCode), 'color:#6366f1;font-family:monospace', true)}
${row('Concepto', escapeHtml(concept), 'color:#334155', false)}
${row('Valor', escapeHtml(formatCop(input.amount)), 'color:#059669;font-size:18px;font-weight:800;font-family:monospace', true)}
${row('Vencimiento', escapeHtml(formatDay(input.dueDate)), 'color:#dc2626;font-weight:700', false)}
</table>
<p style="color:#334155;font-size:14px;line-height:1.6">Puede realizar su pago en la caja del colegio, por transferencia bancaria o a través de nuestros canales electrónicos.</p>
<p style="color:#94a3b8;font-size:12px">Este es un mensaje automático generado por el sistema Apreu. Si tiene dudas, contacte a la administración del colegio.</p>`;
    const subject = `Cobro de ${concept} — ${input.studentName}`;
    return rendered(subject, layout({ title: subject, schoolName: input.schoolName, headerColor: '#4f46e5', content }));
  },

  /**
   * Electronic invoice delivered to the buyer (legacy
   * `api/dian/send_invoice_email.php`). Logo and promo images are inline
   * attachments referenced by `cid:` so no public URL is needed.
   */
  invoice(input: {
    number: string;
    customerName: string;
    total: number;
    issueDate: string;
    businessName: string;
    nit: string;
    resolutionNumber: string;
    brandColor: string;
    logoCid: string | null;
    promoCid: string | null;
  }): RenderedEmail {
    const brand = input.brandColor;
    const logo = input.logoCid
      ? `<img src="cid:${escapeHtml(input.logoCid)}" alt="Logo" style="max-height:80px;max-width:250px;margin-bottom:10px">`
      : '';
    const promo = input.promoCid
      ? `<div><img src="cid:${escapeHtml(input.promoCid)}" alt="Promoción" style="width:100%;max-width:600px;display:block"></div>`
      : '';
    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Factura ${escapeHtml(input.number)}</title></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5">
<div style="max-width:600px;margin:20px auto;background:#ffffff;border-radius:12px;overflow:hidden">
<div style="background:${brand};padding:30px 40px;text-align:center">${logo}<h1 style="color:#ffffff;margin:0;font-size:22px">¡Hola! Adjuntamos tu factura electrónica</h1></div>
<div style="padding:30px 40px">
<p style="color:#333;font-size:14px;line-height:1.6">La factura electrónica de <strong>${escapeHtml(input.customerName)}</strong> ya está disponible.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:25px 0;background:#f9f9f9;border-radius:8px"><tr>
<td style="padding:20px"><div style="color:#888;font-size:12px">Factura N°:</div><div style="font-size:20px;font-weight:bold;color:#333">${escapeHtml(input.number)}</div></td>
<td style="padding:20px;text-align:right"><div style="color:#888;font-size:12px">Total:</div><div style="font-size:20px;font-weight:bold;color:${brand}">${escapeHtml(formatCop(input.total))}</div></td>
</tr></table>
<div style="color:#888;font-size:12px;margin:15px 0"><strong>Fecha de emisión:</strong> ${escapeHtml(formatDay(input.issueDate))}</div>
<div style="background:#f9f9f9;border-left:4px solid ${brand};padding:15px;margin:20px 0;font-size:11px;color:#666;line-height:1.5"><strong>${escapeHtml(input.businessName)}</strong>, facturador electrónico, mediante resolución de numeración DIAN ${escapeHtml(input.resolutionNumber)} hace entrega del documento electrónico (FACTURA ELECTRÓNICA DE VENTA).</div>
<p style="color:#333;font-size:13px">Encontrarás adjunto el documento electrónico de la factura.</p>
</div>
${promo}
<div style="background:#f9f9f9;padding:20px 40px;text-align:center;font-size:11px;color:#999;border-top:1px solid #eee"><p style="margin:4px 0">${escapeHtml(input.businessName)} | NIT: ${escapeHtml(input.nit)}</p><p style="margin:4px 0">Este correo fue generado automáticamente.</p></div>
</div>
</body></html>`;
    return rendered(`Factura Electrónica ${input.number} - ${input.businessName}`, html);
  },

  /** Report card available for a student (reaction to `academic.bulletins-generated`). */
  bulletinAvailable(input: {
    studentName: string;
    periodName: string;
    guardianName: string | null;
    schoolName: string;
    primaryColor: string;
  }): RenderedEmail {
    const subject = `Boletín de ${input.periodName} disponible — ${input.studentName}`;
    const content = `<h2 style="margin:0 0 16px;color:#47557c;font-size:18px">Boletín disponible</h2>
<p style="color:#334155;font-size:14px;line-height:1.7">Estimado(a) ${escapeHtml(input.guardianName || 'acudiente')}:</p>
<p style="color:#334155;font-size:14px;line-height:1.7">El boletín del periodo <strong>${escapeHtml(input.periodName)}</strong> de <strong>${escapeHtml(input.studentName)}</strong> ya está disponible en el portal del estudiante.</p>
<p style="color:#94a3b8;font-size:12px">Este es un mensaje automático generado por el sistema Apreu.</p>`;
    return rendered(
      subject,
      layout({ title: subject, schoolName: input.schoolName, headerColor: input.primaryColor, content }),
    );
  },

  /** Message sent by the SMTP connection test. */
  smtpTest(input: { schoolName: string; primaryColor: string }): RenderedEmail {
    const subject = 'Prueba de configuración de correo — Apreu';
    const content = `<h2 style="margin:0 0 16px;color:#47557c;font-size:18px">¡La configuración funciona!</h2>
<p style="color:#334155;font-size:14px;line-height:1.7">Este correo confirma que la cuenta SMTP del colegio puede enviar mensajes.</p>`;
    return rendered(
      subject,
      layout({ title: subject, schoolName: input.schoolName, headerColor: input.primaryColor, content }),
    );
  },
};

// src/services/mailService.js
import nodemailer from 'nodemailer';

// Transporter SMTP de Hostinger.
// Credenciales en .env: MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS, MAIL_FROM_NAME
//
// IMPORTANTE: el transporter se crea de forma PEREZOSA (al primer envío) y NO al
// importar el módulo. En ES modules los `import` se ejecutan antes que
// `dotenv.config()`, por lo que crear el transporter en el top-level leería las
// credenciales como `undefined` y Hostinger respondería 535 authentication failed.
let _transporter = null;

const getTransporter = () => {
    if (_transporter) return _transporter;
    _transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST || 'smtp.hostinger.com',
        port: Number(process.env.MAIL_PORT) || 465,
        secure: Number(process.env.MAIL_PORT) !== 587, // 465 = SSL, 587 = STARTTLS
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS,
        },
    });
    return _transporter;
};

/** Verifica conexión + login SMTP. Útil al arrancar para detectar credenciales malas. */
export const verificarConexionCorreo = () => getTransporter().verify();

/**
 * Envía un correo con uno o más PDFs adjuntos.
 * @param {Object} opts
 * @param {string} opts.to - Destinatario.
 * @param {string} opts.subject
 * @param {string} opts.html
 * @param {Array<{filename: string, content: Buffer}>} opts.adjuntos
 */
export const enviarCorreoConAdjuntos = ({ to, subject, html, adjuntos = [] }) => {
    const fromName = process.env.MAIL_FROM_NAME || 'RapiCtrl';
    return getTransporter().sendMail({
        from: `"${fromName}" <${process.env.MAIL_USER}>`,
        to,
        subject,
        html,
        attachments: adjuntos.map(({ filename, content }) => ({
            filename,
            content,
            contentType: 'application/pdf',
        })),
    });
};

/** Convierte un documento PDFKit (stream) en un Buffer en memoria. Llama internamente a doc.end(). */
export const pdfDocABuffer = (doc) =>
    new Promise((resolve, reject) => {
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        doc.end();
    });

export default getTransporter;

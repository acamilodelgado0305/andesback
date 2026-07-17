// src/controllers/certificadoController.js

import fetch from 'node-fetch';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

// Dibuja un patrón de ondas semitransparente sobre la página actual del documento.
// Actúa como marca de seguridad anti-copia: las ondas se reproducen distorsionadas
// en fotocopias o escaneos de baja calidad, haciendo evidente la copia.
const dibujarPatronOndas = (doc, opciones = {}) => {
    const {
        color = '#1a3a8a',
        opacidad = 0.055,
        amplitud = 4.5,
        frecuencia = 22,
        espaciado = 9,
        grosor = 0.4,
    } = opciones;

    const w = doc.page.width;
    const h = doc.page.height;

    doc.save();
    doc.lineWidth(grosor);

    // Capa 1: ondas horizontales (izquierda → derecha)
    for (let y = espaciado / 2; y <= h + amplitud; y += espaciado) {
        doc.moveTo(0, y);
        for (let x = 0; x < w; x += frecuencia) {
            doc.bezierCurveTo(
                x + frecuencia * 0.25, y - amplitud,
                x + frecuencia * 0.75, y + amplitud,
                x + frecuencia, y
            );
        }
        doc.strokeColor(color, opacidad).stroke();
    }

    // Capa 2: ondas con fase invertida y frecuencia distinta (crea efecto moiré con la capa 1)
    const f2 = frecuencia * 1.4;
    const offset = espaciado * 0.6;
    for (let y = offset; y <= h + amplitud; y += espaciado * 1.6) {
        doc.moveTo(0, y);
        for (let x = 0; x < w; x += f2) {
            doc.bezierCurveTo(
                x + f2 * 0.25, y + amplitud,
                x + f2 * 0.75, y - amplitud,
                x + f2, y
            );
        }
        doc.strokeColor(color, opacidad * 0.75).stroke();
    }

    doc.restore();
};


// Necesitamos 'fs' y 'path' para leer las imágenes de fondo
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { enviarCorreoConAdjuntos, pdfDocABuffer } from '../services/mailService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper para generar una plantilla de correo HTML profesional y responsiva
const obtenerHtmlCorreo = ({ nombre, tipoDocumento, numeroDocumento, intensidadHoraria, tipoEnvio }) => {
    const tituloBanner = "Curso de Manipulación de Alimentos";
    const subtituloBanner = "Acreditación y Documentos Oficiales";
    let introduccion = "";
    let listaDocumentosHtml = "";

    if (tipoEnvio === 'certificado') {
        introduccion = "¡Felicitaciones! 🎉 Has completado satisfactoriamente tu formación. Adjunto a este correo encontrarás tu <strong>Certificado de Finalización</strong> en formato PDF.";
        listaDocumentosHtml = `
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px; display: flex; align-items: center;">
                <span style="font-size: 24px; margin-right: 12px; line-height: 1;">📜</span>
                <div>
                    <h4 style="margin: 0; color: #1e293b; font-size: 14px; font-weight: 600;">Certificado de Finalización</h4>
                    <p style="margin: 2px 0 0; color: #64748b; font-size: 12px;">Documento oficial que acredita la aprobación del curso.</p>
                </div>
            </div>
        `;
    } else if (tipoEnvio === 'carnet') {
        introduccion = "Hola. Adjunto a este correo encontrarás tu <strong>Carnet Estudiantil</strong> oficial en formato PDF.";
        listaDocumentosHtml = `
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px; display: flex; align-items: center;">
                <span style="font-size: 24px; margin-right: 12px; line-height: 1;">🪪</span>
                <div>
                    <h4 style="margin: 0; color: #1e293b; font-size: 14px; font-weight: 600;">Carnet de Manipulación de Alimentos</h4>
                    <p style="margin: 2px 0 0; color: #64748b; font-size: 12px;">Identificación oficial de acreditación del curso.</p>
                </div>
            </div>
        `;
    } else {
        introduccion = "¡Felicitaciones! 🎉 Has completado satisfactoriamente el curso de <strong>Manipulación de Alimentos</strong>. Adjunto a este correo encontrarás tus <strong>documentos oficiales</strong> en formato PDF:";
        listaDocumentosHtml = `
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px; display: flex; align-items: center;">
                <span style="font-size: 24px; margin-right: 12px; line-height: 1;">📜</span>
                <div>
                    <h4 style="margin: 0; color: #1e293b; font-size: 14px; font-weight: 600;">Certificado de Finalización</h4>
                    <p style="margin: 2px 0 0; color: #64748b; font-size: 12px;">Acredita la aprobación del curso.</p>
                </div>
            </div>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px; display: flex; align-items: center;">
                <span style="font-size: 24px; margin-right: 12px; line-height: 1;">🪪</span>
                <div>
                    <h4 style="margin: 0; color: #1e293b; font-size: 14px; font-weight: 600;">Carnet Estudiantil</h4>
                    <p style="margin: 2px 0 0; color: #64748b; font-size: 12px;">Documento de identificación y acreditación.</p>
                </div>
            </div>
        `;
    }

    return `
    <div style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.05);border:1px solid #e2e8f0;">
              <!-- Cabecera Corporativa -->
              <tr>
                <td style="background-color:#155153;padding:32px;text-align:center;border-bottom:4px solid #c5a059;">
                  <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;line-height:1.2;">
                    ${tituloBanner}
                  </h1>
                  <p style="margin:6px 0 0;color:#cbd5e1;font-size:13px;letter-spacing:0.5px;text-transform:uppercase;">
                    ${subtituloBanner}
                  </p>
                </td>
              </tr>
              <!-- Contenido -->
              <tr>
                <td style="padding:40px 32px 32px 32px;">
                  <h2 style="margin:0 0 16px;color:#1e293b;font-size:18px;font-weight:700;letter-spacing:-0.3px;">
                    Hola ${nombre},
                  </h2>
                  <p style="margin:0 0 24px;color:#334155;font-size:14px;line-height:1.6;">
                    ${introduccion}
                  </p>
                  
                  <!-- Lista de Documentos -->
                  <div style="margin-bottom:24px;">
                    ${listaDocumentosHtml}
                  </div>

                  <!-- Detalle de Acreditación -->
                  <h3 style="margin:0 0 12px;color:#475569;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">
                    Detalles del Registro:
                  </h3>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background-color:#f8fafc;">
                    <tr>
                      <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;width:35%;"><strong>Estudiante:</strong></td>
                      <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#1e293b;">${nombre}</td>
                    </tr>
                    <tr>
                      <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;"><strong>Identificación:</strong></td>
                      <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#1e293b;">${tipoDocumento} ${numeroDocumento}</td>
                    </tr>
                    <tr>
                      <td style="padding:14px 16px;font-size:13px;color:#64748b;"><strong>Intensidad Horaria:</strong></td>
                      <td style="padding:14px 16px;font-size:13px;color:#1e293b;">${intensidadHoraria || '40'} horas</td>
                    </tr>
                  </table>

                  <p style="margin:0 0 8px;color:#334155;font-size:13px;line-height:1.6;">
                    Te recomendamos descargar y almacenar estos archivos para tu uso oficial.
                  </p>
                  <p style="margin:0 0 8px;color:#64748b;font-size:12px;line-height:1.6;font-style:italic;">
                    * Ambos documentos cuentan con firma digital y un código QR de autenticidad verificable.
                  </p>
                </td>
              </tr>
              <!-- Firma y Despedida -->
              <tr>
                <td style="background-color:#f8fafc;padding:24px 32px;border-top:1px solid #e2e8f0;text-align:center;">
                  <p style="margin:0;color:#155153;font-size:13px;font-weight:700;letter-spacing:0.3px;">
                    Alianza Capacitarte
                  </p>
                  <p style="margin:4px 0 0;color:#64748b;font-size:12px;">
                    Notificaciones Automáticas
                  </p>
                  <p style="margin:20px 0 0;color:#94a3b8;font-size:10px;line-height:1.4;">
                    Este es un correo de notificación automática. Por favor no respondas a este mensaje.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
    `;
};

// ──────────────────────────────────────────────────────────────────────────
// Helpers de fecha
// ──────────────────────────────────────────────────────────────────────────

// Formatea una fecha (ISO, 'YYYY-MM-DD', Date, timestamp) a 'dd/mm/yyyy'.
// Si no se provee o es inválida, usa la fecha ACTUAL (comportamiento previo).
// Para strings ISO se toma la parte de fecha para evitar corrimientos por zona
// horaria (que un timestamp a medianoche UTC pinte el día anterior).
const formatFechaDDMMYYYY = (value) => {
    if (value) {
        const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return `${m[3]}/${m[2]}/${m[1]}`;
        const d = new Date(value);
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' });
        }
    }
    return new Date().toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

// Suma un año a la fecha de expedición y la formatea. Se usa para el vencimiento
// del carnet cuando no viene una fecha de vencimiento explícita.
const addOneYearFormatted = (value) => {
    const m = value && String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${Number(m[1]) + 1}`;
    let base = value ? new Date(value) : new Date();
    if (isNaN(base.getTime())) base = new Date();
    base.setFullYear(base.getFullYear() + 1);
    return base.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

// ──────────────────────────────────────────────────────────────────────────
// Funciones de DIBUJO reutilizables: dibujan sobre un doc PDFKit ya creado.
// NO hacen pipe ni end — eso queda a cargo de quien las llama (descarga o correo).
// ──────────────────────────────────────────────────────────────────────────

// Dibuja el contenido del CERTIFICADO sobre el doc.
// fechaExpedicion es opcional; si falta, se usa la fecha actual.
const dibujarCertificado = async (doc, { nombre, numeroDocumento, tipoDocumento, intensidadHoraria, fechaExpedicion }) => {
    const certificadoImagePath = path.join(__dirname, '..', 'imagenes', 'certificado.jpg');
    const certificadoImageBuffer = fs.readFileSync(certificadoImagePath);

    doc.image(certificadoImageBuffer, 0, 0, { width: doc.page.width, height: doc.page.height });

    doc.fillColor('black');

    // Fecha de expedición real del registro; si no llega, cae a la fecha actual.
    const fechaExp = formatFechaDDMMYYYY(fechaExpedicion);

    doc.fontSize(15).font('Helvetica').text(nombre, 0, 165, {
        align: 'center',
        width: doc.page.width,
    });

    doc.fontSize(15).font('Helvetica').text(`${tipoDocumento}: ${numeroDocumento}`, 124, 199, {
        align: 'center',
        width: doc.page.width,
    });

    doc.fontSize(14).text(fechaExp, -80, 328, {
        align: 'center',
        width: doc.page.width,
    });

    doc.fontSize(14).font('Helvetica').text(`${intensidadHoraria}`, 129, 328, {
        align: 'center',
        width: doc.page.width,
    });

    doc.fontSize(14).text(fechaExp, -130, 618, {
        align: 'center',
        width: doc.page.width,
    });

    const urlVerificacion = 'https://rapictrl.com/verificacion';
    const qrCodeImage = await QRCode.toDataURL(urlVerificacion, {
        errorCorrectionLevel: 'H',
        margin: 2,
        scale: 4,
    });

    doc.image(qrCodeImage, 475, 720, { width: 80 });

    // Patrón de seguridad anti-copia (encima de todo el contenido)
    dibujarPatronOndas(doc);
};

// Dibuja el contenido del CARNET (frontal + posterior) sobre el doc.
// fotoBuffer es opcional (Buffer de la foto del estudiante).
// fechaExpedicion / fechaVencimiento son opcionales; si faltan se usa la fecha
// actual (expedición) y expedición + 1 año (vencimiento).
const dibujarCarnet = async (doc, { nombre, numeroDocumento, tipoDocumento, intensidadHoraria, fechaExpedicion, fechaVencimiento }, fotoBuffer) => {
    const frontalImagePath = path.join(__dirname, '..', 'imagenes', 'frontal.jpg');
    const posteriorImagePath = path.join(__dirname, '..', 'imagenes', 'posterior.jpg');
    const frontalImageBuffer = fs.readFileSync(frontalImagePath);
    const posteriorImageBuffer = fs.readFileSync(posteriorImagePath);

    // --- Página Frontal del Carnet ---
    doc.image(frontalImageBuffer, 0, 0, { width: doc.page.width, height: doc.page.height });

    if (fotoBuffer) {
        doc.image(fotoBuffer, 155, 40, { width: 65, height: 80, align: 'center', valign: 'center' });
    }

    doc.fillColor('black');
    doc.fontSize(7).text(nombre, 8, 60, { width: 150, align: 'center' });
    doc.fontSize(7).text(tipoDocumento, 55, 73, { width: 150, align: 'left' });
    doc.fontSize(7).text(intensidadHoraria, 92, 106, { width: 150, align: 'left' });
    doc.fontSize(7).text(numeroDocumento, 75, 73, { width: 150, align: 'left' });

    // Fecha de expedición real; si no llega, cae a la fecha actual.
    const fechaExp = formatFechaDDMMYYYY(fechaExpedicion);
    doc.fontSize(6).text(fechaExp, 202, 134, { width: 100, align: 'left' });

    dibujarPatronOndas(doc, { amplitud: 2, frecuencia: 10, espaciado: 4.5, grosor: 0.3 });

    // --- Página Posterior del Carnet ---
    doc.addPage({ size: [85.6 * 2.83, 54 * 2.83], margin: 0 });
    doc.image(posteriorImageBuffer, 0, 0, { width: doc.page.width, height: doc.page.height });

    // Vencimiento del registro si viene; si no, expedición + 1 año.
    const fechaVenc = fechaVencimiento
        ? formatFechaDDMMYYYY(fechaVencimiento)
        : addOneYearFormatted(fechaExpedicion);
    doc.fillColor('black').fontSize(7).text(fechaVenc, 33, 137, { width: 100, align: 'left' });

    const urlVerificacion = 'https://quickcontrola.com/verificacion';
    const qrCodeImage = await QRCode.toDataURL(urlVerificacion, {
        errorCorrectionLevel: 'H',
        margin: 1,
        scale: 3,
    });

    doc.image(qrCodeImage, 180, 25, { width: 40 });

    dibujarPatronOndas(doc, { amplitud: 2, frecuencia: 10, espaciado: 4.5, grosor: 0.3 });
};

// --- URLs de tus Web Apps de Google Apps Script ---
// ¡MUY IMPORTANTE! Reemplaza estas URLs con las que obtuviste al desplegar tus scripts.

// URL para el script que genera CERTIFICADOS (YA NO LA USAREMOS PARA EL CERTIFICADO LOCAL)

// Controlador para generar un CERTIFICADO
// //////////////////////////////////////////////////////////////////////////////////
const generarCertificadoController = async (req, res) => {
    const { nombre, numeroDocumento, tipoDocumento, intensidadHoraria } = req.body;

    if (!nombre || !numeroDocumento || !tipoDocumento) {
        return res.status(400).json({ error: 'Nombre, número de documento y tipo de documento son requeridos.' });
    }

    console.log(`Solicitud de certificado para: ${nombre}, Doc: ${numeroDocumento}`);

    try {
        const fileName = `Certificado_${nombre.replace(/\s/g, '_')}_${numeroDocumento}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        const doc = new PDFDocument({
            size: 'A4',
            margin: 0,
        });

        doc.pipe(res);

        await dibujarCertificado(doc, { nombre, numeroDocumento, tipoDocumento, intensidadHoraria, fechaExpedicion: req.body.fechaExpedicion });

        doc.end();

        console.log(`Certificado PDF generado y enviado para: ${nombre}`);

    } catch (err) {
        console.error('Error al generar el certificado:', err);
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Error interno del servidor al generar el certificado.',
                details: err.message,
            });
        }
    }
};

// //////////////////////////////////////////////////////////////////////////////////
// Controlador para generar un CARNET
// //////////////////////////////////////////////////////////////////////////////////
const generarCarnetController = async (req, res) => {
    const { nombre, numeroDocumento, tipoDocumento, intensidadHoraria } = req.body;
    const fotoFile = req.file;

    try {
        if (!nombre || !numeroDocumento || !tipoDocumento) {
            return res.status(400).json({ error: 'Nombre, número de documento y tipo de documento son requeridos.' });
        }

        if (fotoFile) {
            console.log(`Solicitud de carnet para: ${nombre} con foto: ${fotoFile.originalname}`);
        } else {
            console.log(`Solicitud de carnet para: ${nombre} (sin foto adjunta).`);
        }

        const fileName = `Carnet_${nombre.replace(/\s/g, '_')}_${numeroDocumento}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        const doc = new PDFDocument({
            size: [85.6 * 2.83, 54 * 2.83], // Aprox. 242.5 x 153 pt
            margin: 0,
        });

        doc.pipe(res);

        const fotoBuffer = fotoFile ? fs.readFileSync(fotoFile.path) : null;
        await dibujarCarnet(doc, { nombre, numeroDocumento, tipoDocumento, intensidadHoraria, fechaExpedicion: req.body.fechaExpedicion, fechaVencimiento: req.body.fechaVencimiento }, fotoBuffer);

        doc.end();
        console.log(`Carnet PDF generado y enviado para: ${nombre}`);

    } catch (err) {
        console.error('Error al generar el carnet:', err);
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Error interno del servidor al generar el carnet.',
                details: err.message,
            });
        }
    } finally {
        if (fotoFile) {
            fs.unlinkSync(fotoFile.path);
            console.log(`Archivo temporal ${fotoFile.path} eliminado.`);
        }
    }
};
;

// //////////////////////////////////////////////////////////////////////////////////
// Controlador para GENERAR y ENVIAR el CERTIFICADO por correo
// //////////////////////////////////////////////////////////////////////////////////
const enviarCertificadoController = async (req, res) => {
    const { nombre, numeroDocumento, tipoDocumento, intensidadHoraria, email } = req.body;

    if (!nombre || !numeroDocumento || !tipoDocumento) {
        return res.status(400).json({ error: 'Nombre, número de documento y tipo de documento son requeridos.' });
    }
    if (!email) {
        return res.status(400).json({ error: 'El correo del destinatario (email) es requerido.' });
    }

    try {
        const doc = new PDFDocument({ size: 'A4', margin: 0 });
        await dibujarCertificado(doc, { nombre, numeroDocumento, tipoDocumento, intensidadHoraria, fechaExpedicion: req.body.fechaExpedicion });
        const pdfBuffer = await pdfDocABuffer(doc);

        const fileName = `Certificado_${nombre.replace(/\s/g, '_')}_${numeroDocumento}.pdf`;

        await enviarCorreoConAdjuntos({
            to: email,
            subject: 'Tu certificado de finalización — Manipulación de Alimentos',
            html: obtenerHtmlCorreo({ nombre, tipoDocumento, numeroDocumento, intensidadHoraria, tipoEnvio: 'certificado' }),
            adjuntos: [{ filename: fileName, content: pdfBuffer }],
        });

        console.log(`Certificado enviado por correo a ${email} para: ${nombre}`);
        res.status(200).json({ mensaje: 'Certificado enviado por correo correctamente.', email });
    } catch (err) {
        console.error('Error al enviar el certificado por correo:', err);
        res.status(500).json({
            error: 'Error interno del servidor al enviar el certificado.',
            details: err.message,
        });
    }
};

// //////////////////////////////////////////////////////////////////////////////////
// Controlador para GENERAR y ENVIAR el CARNET por correo
// //////////////////////////////////////////////////////////////////////////////////
const enviarCarnetController = async (req, res) => {
    const { nombre, numeroDocumento, tipoDocumento, intensidadHoraria, email } = req.body;
    const fotoFile = req.file;

    try {
        if (!nombre || !numeroDocumento || !tipoDocumento) {
            return res.status(400).json({ error: 'Nombre, número de documento y tipo de documento son requeridos.' });
        }
        if (!email) {
            return res.status(400).json({ error: 'El correo del destinatario (email) es requerido.' });
        }

        const doc = new PDFDocument({ size: [85.6 * 2.83, 54 * 2.83], margin: 0 });
        const fotoBuffer = fotoFile ? fs.readFileSync(fotoFile.path) : null;
        await dibujarCarnet(doc, { nombre, numeroDocumento, tipoDocumento, intensidadHoraria, fechaExpedicion: req.body.fechaExpedicion, fechaVencimiento: req.body.fechaVencimiento }, fotoBuffer);
        const pdfBuffer = await pdfDocABuffer(doc);

        const fileName = `Carnet_${nombre.replace(/\s/g, '_')}_${numeroDocumento}.pdf`;

        await enviarCorreoConAdjuntos({
            to: email,
            subject: 'Tu carnet estudiantil — Manipulación de Alimentos',
            html: obtenerHtmlCorreo({ nombre, tipoDocumento, numeroDocumento, intensidadHoraria, tipoEnvio: 'carnet' }),
            adjuntos: [{ filename: fileName, content: pdfBuffer }],
        });

        console.log(`Carnet enviado por correo a ${email} para: ${nombre}`);
        res.status(200).json({ mensaje: 'Carnet enviado por correo correctamente.', email });
    } catch (err) {
        console.error('Error al enviar el carnet por correo:', err);
        res.status(500).json({
            error: 'Error interno del servidor al enviar el carnet.',
            details: err.message,
        });
    } finally {
        if (fotoFile) {
            fs.unlinkSync(fotoFile.path);
            console.log(`Archivo temporal ${fotoFile.path} eliminado.`);
        }
    }
};

// //////////////////////////////////////////////////////////////////////////////////
// Controlador para GENERAR y ENVIAR CERTIFICADO + CARNET en UN SOLO correo
// //////////////////////////////////////////////////////////////////////////////////
const enviarDocumentosController = async (req, res) => {
    const { nombre, numeroDocumento, tipoDocumento, intensidadHoraria, email } = req.body;
    const fotoFile = req.file;

    if (!nombre || !numeroDocumento || !tipoDocumento) {
        return res.status(400).json({ error: 'Nombre, número de documento y tipo de documento son requeridos.' });
    }
    if (!email) {
        return res.status(400).json({ error: 'El correo del destinatario (email) es requerido.' });
    }

    try {
        // 1) Certificado (A4)
        const docCert = new PDFDocument({ size: 'A4', margin: 0 });
        await dibujarCertificado(docCert, { nombre, numeroDocumento, tipoDocumento, intensidadHoraria, fechaExpedicion: req.body.fechaExpedicion });
        const certBuffer = await pdfDocABuffer(docCert);

        // 2) Carnet (tarjeta)
        const docCarnet = new PDFDocument({ size: [85.6 * 2.83, 54 * 2.83], margin: 0 });
        const fotoBuffer = fotoFile ? fs.readFileSync(fotoFile.path) : null;
        await dibujarCarnet(docCarnet, { nombre, numeroDocumento, tipoDocumento, intensidadHoraria, fechaExpedicion: req.body.fechaExpedicion, fechaVencimiento: req.body.fechaVencimiento }, fotoBuffer);
        const carnetBuffer = await pdfDocABuffer(docCarnet);

        const certFileName   = `Certificado_${nombre.replace(/\s/g, '_')}_${numeroDocumento}.pdf`;
        const carnetFileName = `Carnet_${nombre.replace(/\s/g, '_')}_${numeroDocumento}.pdf`;

        await enviarCorreoConAdjuntos({
            to: email,
            subject: 'Certificado y carnet — Manipulación de Alimentos',
            html: obtenerHtmlCorreo({ nombre, tipoDocumento, numeroDocumento, intensidadHoraria, tipoEnvio: 'ambos' }),
            adjuntos: [
                { filename: certFileName, content: certBuffer },
                { filename: carnetFileName, content: carnetBuffer },
            ],
        });

        console.log(`Certificado + carnet enviados en un solo correo a ${email} para: ${nombre}`);
        res.status(200).json({ mensaje: 'Certificado y carnet enviados por correo correctamente.', email });
    } catch (err) {
        console.error('Error al enviar los documentos por correo:', err);
        res.status(500).json({
            error: 'Error interno del servidor al enviar los documentos.',
            details: err.message,
        });
    } finally {
        if (fotoFile) {
            fs.unlinkSync(fotoFile.path);
            console.log(`Archivo temporal ${fotoFile.path} eliminado.`);
        }
    }
};

// Exporta los controladores para que estén disponibles en tus rutas
export {
    generarCertificadoController,
    generarCarnetController,
    enviarCertificadoController,
    enviarCarnetController,
    enviarDocumentosController
};
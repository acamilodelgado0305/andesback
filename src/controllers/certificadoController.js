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

// ──────────────────────────────────────────────────────────────────────────
// Funciones de DIBUJO reutilizables: dibujan sobre un doc PDFKit ya creado.
// NO hacen pipe ni end — eso queda a cargo de quien las llama (descarga o correo).
// ──────────────────────────────────────────────────────────────────────────

// Dibuja el contenido del CERTIFICADO sobre el doc.
const dibujarCertificado = async (doc, { nombre, numeroDocumento, tipoDocumento, intensidadHoraria }) => {
    const certificadoImagePath = path.join(__dirname, '..', 'imagenes', 'certificado.png');
    const certificadoImageBuffer = fs.readFileSync(certificadoImagePath);

    doc.image(certificadoImageBuffer, 0, 0, { width: doc.page.width, height: doc.page.height });

    doc.fillColor('black');

    const fechaActual = new Date().toLocaleDateString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).replace(/\//g, '/');

    doc.fontSize(15).font('Helvetica').text(nombre, 0, 165, {
        align: 'center',
        width: doc.page.width,
    });

    doc.fontSize(15).font('Helvetica').text(`${tipoDocumento}: ${numeroDocumento}`, 124, 199, {
        align: 'center',
        width: doc.page.width,
    });

    doc.fontSize(14).text(fechaActual, -80, 328, {
        align: 'center',
        width: doc.page.width,
    });

    doc.fontSize(14).font('Helvetica').text(`${intensidadHoraria}`, 129, 328, {
        align: 'center',
        width: doc.page.width,
    });

    doc.fontSize(14).text(fechaActual, -130, 618, {
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
const dibujarCarnet = async (doc, { nombre, numeroDocumento, tipoDocumento, intensidadHoraria }, fotoBuffer) => {
    const frontalImagePath = path.join(__dirname, '..', 'imagenes', 'frontal.png');
    const posteriorImagePath = path.join(__dirname, '..', 'imagenes', 'posterior.png');
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

    const fechaActual = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
    doc.fontSize(6).text(fechaActual, 202, 134, { width: 100, align: 'left' });

    dibujarPatronOndas(doc, { amplitud: 2, frecuencia: 10, espaciado: 4.5, grosor: 0.3 });

    // --- Página Posterior del Carnet ---
    doc.addPage({ size: [85.6 * 2.83, 54 * 2.83], margin: 0 });
    doc.image(posteriorImageBuffer, 0, 0, { width: doc.page.width, height: doc.page.height });

    const fechaVencimiento = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
    doc.fillColor('black').fontSize(7).text(fechaVencimiento, 33, 137, { width: 100, align: 'left' });

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

        await dibujarCertificado(doc, { nombre, numeroDocumento, tipoDocumento, intensidadHoraria });

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
        await dibujarCarnet(doc, { nombre, numeroDocumento, tipoDocumento, intensidadHoraria }, fotoBuffer);

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
        await dibujarCertificado(doc, { nombre, numeroDocumento, tipoDocumento, intensidadHoraria });
        const pdfBuffer = await pdfDocABuffer(doc);

        const fileName = `Certificado_${nombre.replace(/\s/g, '_')}_${numeroDocumento}.pdf`;

        await enviarCorreoConAdjuntos({
            to: email,
            subject: 'Tu certificado de finalización',
            html: `
                <p>Hola <strong>${nombre}</strong>,</p>
                <p>Adjuntamos tu certificado de finalización. ¡Felicitaciones por completar tu formación!</p>
            `,
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
        await dibujarCarnet(doc, { nombre, numeroDocumento, tipoDocumento, intensidadHoraria }, fotoBuffer);
        const pdfBuffer = await pdfDocABuffer(doc);

        const fileName = `Carnet_${nombre.replace(/\s/g, '_')}_${numeroDocumento}.pdf`;

        await enviarCorreoConAdjuntos({
            to: email,
            subject: 'Tu carnet estudiantil',
            html: `
                <p>Hola <strong>${nombre}</strong>,</p>
                <p>Adjuntamos tu carnet estudiantil en formato PDF.</p>
                <p>Saludos cordiales,<br/>Fundación Educativa Villa de los Andes</p>
            `,
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
        await dibujarCertificado(docCert, { nombre, numeroDocumento, tipoDocumento, intensidadHoraria });
        const certBuffer = await pdfDocABuffer(docCert);

        // 2) Carnet (tarjeta)
        const docCarnet = new PDFDocument({ size: [85.6 * 2.83, 54 * 2.83], margin: 0 });
        const fotoBuffer = fotoFile ? fs.readFileSync(fotoFile.path) : null;
        await dibujarCarnet(docCarnet, { nombre, numeroDocumento, tipoDocumento, intensidadHoraria }, fotoBuffer);
        const carnetBuffer = await pdfDocABuffer(docCarnet);

        const certFileName   = `Certificado_${nombre.replace(/\s/g, '_')}_${numeroDocumento}.pdf`;
        const carnetFileName = `Carnet_${nombre.replace(/\s/g, '_')}_${numeroDocumento}.pdf`;

        await enviarCorreoConAdjuntos({
            to: email,
            subject: 'Certificado y carnet — Manipulación de Alimentos',
            html: `
            <div style="margin:0;padding:0;background-color:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8;padding:24px 0;">
                <tr>
                  <td align="center">
                    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.06);">
                      <!-- Encabezado -->
                      <tr>
                        <td style="background-color:#155153;padding:28px 32px;text-align:center;">
                          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;line-height:1.3;">
                            Curso de Manipulación de Alimentos
                          </h1>
                          <p style="margin:6px 0 0;color:#cfe3e3;font-size:13px;">Certificación de finalización</p>
                        </td>
                      </tr>
                      <!-- Cuerpo -->
                      <tr>
                        <td style="padding:32px;">
                          <p style="margin:0 0 16px;color:#1f2937;font-size:15px;line-height:1.6;">
                            Hola <strong>${nombre}</strong>,
                          </p>
                          <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
                            ¡Felicitaciones! 🎉 Has completado satisfactoriamente el curso de
                            <strong>Manipulación de Alimentos</strong>. Adjunto a este correo encontrarás
                            <strong>dos documentos en PDF</strong>:
                          </p>
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
                            <tr>
                              <td style="padding:12px 16px;background-color:#f0f7f7;border-radius:8px;border-left:4px solid #155153;">
                                <p style="margin:0;color:#155153;font-size:14px;font-weight:700;">📜 Certificado de finalización</p>
                                <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">Acredita la aprobación del curso.</p>
                              </td>
                            </tr>
                            <tr><td style="height:10px;line-height:10px;font-size:10px;">&nbsp;</td></tr>
                            <tr>
                              <td style="padding:12px 16px;background-color:#f0f7f7;border-radius:8px;border-left:4px solid #155153;">
                                <p style="margin:0;color:#155153;font-size:14px;font-weight:700;">🪪 Carnet de manipulación de alimentos</p>
                                <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">Documento de identificación del curso.</p>
                              </td>
                            </tr>
                          </table>
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid #e5e7eb;border-radius:8px;">
                            <tr>
                              <td style="padding:14px 16px;">
                                <p style="margin:0 0 4px;color:#374151;font-size:13px;"><strong>Titular:</strong> ${nombre}</p>
                                <p style="margin:0 0 4px;color:#374151;font-size:13px;"><strong>Documento:</strong> ${tipoDocumento} ${numeroDocumento}</p>
                                <p style="margin:0;color:#374151;font-size:13px;"><strong>Intensidad horaria:</strong> ${intensidadHoraria} horas</p>
                              </td>
                            </tr>
                          </table>
                          <p style="margin:0 0 8px;color:#374151;font-size:14px;line-height:1.6;">
                            Te recomendamos descargar y guardar ambos documentos. El certificado y el carnet
                            cuentan con un código QR de verificación de autenticidad.
                          </p>
                        </td>
                      </tr>
                      <!-- Pie -->
                      <tr>
                        <td style="background-color:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #eef0f2;">
                          <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;">
                            Saludos cordiales,<br/>
                           
                          </p>
                          <p style="margin:10px 0 0;color:#9ca3af;font-size:11px;">
                            Este es un correo automático, por favor no respondas a este mensaje.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </div>
            `,
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
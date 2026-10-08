// src/controllers/certificadoController.js

import fetch from 'node-fetch';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';



// Necesitamos 'fs' y 'path' para leer las imágenes de fondo
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { enviarCorreoConAdjuntos, pdfDocABuffer } from '../services/mailService.js';
import {
    dibujarPatronOndas,
    formatFechaDDMMYYYY,
    addOneYearFormatted,
    ajustarAUnaLinea,
    dibujarQrConCodigo,
} from '../utils/pdfHelpers.js';
import {
    PLANTILLA_ALIMENTOS,
    registrarDocumento,
    urlVerificacion,
} from '../services/documentosEmitidos.js';
import { plantillaCorreoDocumentos } from '../utils/correoDocumentos.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Correo con el que se entregan los documentos de manipulación de alimentos.
// La maqueta es compartida (utils/correoDocumentos.js); aquí solo van los textos
// propios de esta plantilla.
const TARJETA_CERTIFICADO = {
    icono: '📜',
    titulo: 'Certificado de Finalización',
    detalle: 'Documento oficial que acredita la aprobación del curso.',
};

const TARJETA_CARNET = {
    icono: '🪪',
    titulo: 'Carnet de Manipulación de Alimentos',
    detalle: 'Identificación oficial de acreditación del curso.',
};

const obtenerHtmlCorreo = ({ nombre, tipoDocumento, numeroDocumento, intensidadHoraria, tipoEnvio }) => {
    let introduccion;
    let documentos;

    if (tipoEnvio === 'certificado') {
        introduccion = '¡Felicitaciones! 🎉 Has completado satisfactoriamente tu formación. Adjunto a este correo encontrarás tu <strong>Certificado de Finalización</strong> en formato PDF.';
        documentos = [TARJETA_CERTIFICADO];
    } else if (tipoEnvio === 'carnet') {
        introduccion = 'Hola. Adjunto a este correo encontrarás tu <strong>Carnet Estudiantil</strong> oficial en formato PDF.';
        documentos = [TARJETA_CARNET];
    } else {
        introduccion = '¡Felicitaciones! 🎉 Has completado satisfactoriamente el curso de <strong>Manipulación de Alimentos</strong>. Adjunto a este correo encontrarás tus <strong>documentos oficiales</strong> en formato PDF:';
        documentos = [
            { ...TARJETA_CERTIFICADO, detalle: 'Acredita la aprobación del curso.' },
            { ...TARJETA_CARNET, titulo: 'Carnet Estudiantil', detalle: 'Documento de identificación y acreditación.' },
        ];
    }

    return plantillaCorreoDocumentos({
        nombre,
        titulo: 'Curso de Manipulación de Alimentos',
        introduccion,
        documentos,
        detalles: [
            { label: 'Estudiante', valor: nombre },
            { label: 'Identificación', valor: `${tipoDocumento} ${numeroDocumento}` },
            { label: 'Intensidad Horaria', valor: `${intensidadHoraria || '40'} horas` },
        ],
        nota: '* Ambos documentos cuentan con firma digital y un código QR de autenticidad verificable.',
    });
};

// ──────────────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────────
// Funciones de DIBUJO reutilizables: dibujan sobre un doc PDFKit ya creado.
// NO hacen pipe ni end — eso queda a cargo de quien las llama (descarga o correo).
// ──────────────────────────────────────────────────────────────────────────

// Dibuja el contenido del CERTIFICADO sobre el doc.
// fechaExpedicion es opcional; si falta, se usa la fecha actual.

const dibujarCertificado = async (doc, { nombre, numeroDocumento, tipoDocumento, intensidadHoraria, fechaExpedicion, curso, codigo }) => {
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

    // Curso elegido en el Inventario. La plantilla (certificado.jpg) ya trae el
    // cuerpo impreso, así que el único hueco libre es la franja entre la línea
    // del documento (termina ~y=214) y el párrafo "Recibió capacitación en
    // (BPM)…" (arranca ~y=248). Debe caber en UNA línea: si se desborda invade
    // el párrafo. Ojo: la opción `ellipsis` de pdfkit no aplica con
    // `lineBreak: false`, por eso el ajuste se mide a mano.
    if (curso) {
        const { texto, size } = ajustarAUnaLinea(doc, String(curso).trim(), doc.page.width - 80);
        doc.font('Helvetica-Bold').fontSize(size).text(texto, 0, 222, {
            align: 'center',
            width: doc.page.width,
            lineBreak: false,
        });
        doc.font('Helvetica'); // el resto del certificado va en regular
    }

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

    // El QR abre la verificación de ESTE documento; debajo va su código.
    const qrCodeImage = await QRCode.toDataURL(urlVerificacion(codigo), {
        errorCorrectionLevel: 'H',
        margin: 2,
        scale: 4,
    });

    dibujarQrConCodigo(doc, { qrImage: qrCodeImage, codigo, x: 475, y: 720, size: 80, fontSize: 7 });

    // Patrón de seguridad anti-copia (encima de todo el contenido)
    dibujarPatronOndas(doc);
};

// Dibuja el contenido del CARNET (frontal + posterior) sobre el doc.
// fotoBuffer es opcional (Buffer de la foto del estudiante).
// fechaExpedicion / fechaVencimiento son opcionales; si faltan se usa la fecha
// actual (expedición) y expedición + 1 año (vencimiento).
const dibujarCarnet = async (doc, { nombre, numeroDocumento, tipoDocumento, intensidadHoraria, fechaExpedicion, fechaVencimiento, codigo }, fotoBuffer) => {
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

    const qrCodeImage = await QRCode.toDataURL(urlVerificacion(codigo), {
        errorCorrectionLevel: 'H',
        margin: 1,
        scale: 3,
    });

    dibujarQrConCodigo(doc, { qrImage: qrCodeImage, codigo, x: 180, y: 25, size: 40, fontSize: 4.2 });

    dibujarPatronOndas(doc, { amplitud: 2, frecuencia: 10, espaciado: 4.5, grosor: 0.3 });
};

// --- URLs de tus Web Apps de Google Apps Script ---
// ¡MUY IMPORTANTE! Reemplaza estas URLs con las que obtuviste al desplegar tus scripts.

// URL para el script que genera CERTIFICADOS (YA NO LA USAREMOS PARA EL CERTIFICADO LOCAL)

// Certificado y carnet son la misma acreditación: comparten código de
// verificación (el registro se reutiliza por persona + fecha de expedición).
const registrarAlimentos = (body, extra = {}) => registrarDocumento({
    plantilla: PLANTILLA_ALIMENTOS,
    nombre: body.nombre,
    tipoDocumento: body.tipoDocumento,
    numeroDocumento: body.numeroDocumento,
    curso: body.curso, // el carnet no lo trae: el registro conserva el que ya tenía
    intensidadHoraria: body.intensidadHoraria,
    fechaExpedicion: body.fechaExpedicion,
    fechaVencimiento: body.fechaVencimiento,
    ...extra,
});

// Controlador para generar un CERTIFICADO
// //////////////////////////////////////////////////////////////////////////////////
const generarCertificadoController = async (req, res) => {
    const { nombre, numeroDocumento, tipoDocumento, intensidadHoraria, curso } = req.body;

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

        const codigo = await registrarAlimentos(req.body);
        if (codigo) res.setHeader('X-Folio', codigo);

        doc.pipe(res);

        await dibujarCertificado(doc, { nombre, numeroDocumento, tipoDocumento, intensidadHoraria, fechaExpedicion: req.body.fechaExpedicion, curso, codigo });

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

        const codigo = await registrarAlimentos(req.body);
        if (codigo) res.setHeader('X-Folio', codigo);

        doc.pipe(res);

        const fotoBuffer = fotoFile ? fs.readFileSync(fotoFile.path) : null;
        await dibujarCarnet(doc, { nombre, numeroDocumento, tipoDocumento, intensidadHoraria, fechaExpedicion: req.body.fechaExpedicion, fechaVencimiento: req.body.fechaVencimiento, codigo }, fotoBuffer);

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
        const codigo = await registrarAlimentos(req.body);
        const doc = new PDFDocument({ size: 'A4', margin: 0 });
        await dibujarCertificado(doc, { nombre, numeroDocumento, tipoDocumento, intensidadHoraria, fechaExpedicion: req.body.fechaExpedicion, codigo });
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

        const codigo = await registrarAlimentos(req.body);
        const doc = new PDFDocument({ size: [85.6 * 2.83, 54 * 2.83], margin: 0 });
        const fotoBuffer = fotoFile ? fs.readFileSync(fotoFile.path) : null;
        await dibujarCarnet(doc, { nombre, numeroDocumento, tipoDocumento, intensidadHoraria, fechaExpedicion: req.body.fechaExpedicion, fechaVencimiento: req.body.fechaVencimiento, codigo }, fotoBuffer);
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
        // Un solo código para las dos piezas.
        const codigo = await registrarAlimentos(req.body);

        // 1) Certificado (A4)
        const docCert = new PDFDocument({ size: 'A4', margin: 0 });
        await dibujarCertificado(docCert, { nombre, numeroDocumento, tipoDocumento, intensidadHoraria, fechaExpedicion: req.body.fechaExpedicion, codigo });
        const certBuffer = await pdfDocABuffer(docCert);

        // 2) Carnet (tarjeta)
        const docCarnet = new PDFDocument({ size: [85.6 * 2.83, 54 * 2.83], margin: 0 });
        const fotoBuffer = fotoFile ? fs.readFileSync(fotoFile.path) : null;
        await dibujarCarnet(docCarnet, { nombre, numeroDocumento, tipoDocumento, intensidadHoraria, fechaExpedicion: req.body.fechaExpedicion, fechaVencimiento: req.body.fechaVencimiento, codigo }, fotoBuffer);
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
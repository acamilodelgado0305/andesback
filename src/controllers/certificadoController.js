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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

        const certificadoImagePath = path.join(__dirname, '..', 'imagenes', 'certificado.png');
        const certificadoImageBuffer = fs.readFileSync(certificadoImagePath);

        doc.image(certificadoImageBuffer, 0, 0, { width: doc.page.width, height: doc.page.height });

        doc.fillColor('black');

        const fechaActual = new Date().toLocaleDateString('es-CO', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).replace(/\//g, '/');

        // --- Añadir Nombre ---
        doc.fontSize(15).font('Helvetica').text(nombre, 0, 165, {
            align: 'center',
            width: doc.page.width,
        });

        // --- Añadir Número de Documento ---
        doc.fontSize(15).font('Helvetica').text(`${tipoDocumento}: ${numeroDocumento}`, 124, 199, {
            align: 'center',
            width: doc.page.width,
        });

        // --- Añadir Fechas ---
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

        // ==================================================================
        // <-- 2. GENERACIÓN E INCRUSTACIÓN DEL CÓDIGO QR -->
        // ==================================================================
        const urlVerificacion = 'https://quickcontrola.com/verificacion';

        // Generamos el QR como una imagen en formato Data URL (Base64)
        const qrCodeImage = await QRCode.toDataURL(urlVerificacion, {
            errorCorrectionLevel: 'H', // Alta corrección de errores, bueno para impresión
            margin: 2,
            scale: 4 // Escala de la imagen
        });

        doc.image(qrCodeImage, 475, 720, {
            width: 80
        });
        // ==================================================================

        // Patrón de seguridad anti-copia (encima de todo el contenido)
        dibujarPatronOndas(doc);

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

        const frontalImagePath = path.join(__dirname, '..', 'imagenes', 'frontal.png');
        const posteriorImagePath = path.join(__dirname, '..', 'imagenes', 'posterior.png');
        const frontalImageBuffer = fs.readFileSync(frontalImagePath);
        const posteriorImageBuffer = fs.readFileSync(posteriorImagePath);

        // --- Página Frontal del Carnet ---
        doc.image(frontalImageBuffer, 0, 0, { width: doc.page.width, height: doc.page.height });

        if (fotoFile) {
            const fotoBuffer = fs.readFileSync(fotoFile.path);
            doc.image(fotoBuffer, 155, 40, { width: 65, height: 80, align: 'center', valign: 'center' });
        }

        doc.fillColor('black');
        doc.fontSize(7).text(nombre, 8, 60, { width: 150, align: 'center' });
        doc.fontSize(7).text(tipoDocumento, 55, 73, { width: 150, align: 'left' });
        doc.fontSize(7).text(intensidadHoraria, 92, 106, { width: 150, align: 'left' });
        doc.fontSize(7).text(numeroDocumento, 75, 73, { width: 150, align: 'left' });

        const fechaActual = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
        doc.fontSize(6).text(fechaActual, 202, 134, { width: 100, align: 'left' });

        // Patrón de seguridad en página frontal (encima de todo el contenido)
        dibujarPatronOndas(doc, { amplitud: 2, frecuencia: 10, espaciado: 4.5, grosor: 0.3 });

        // --- Página Posterior del Carnet ---
        doc.addPage({ size: [85.6 * 2.83, 54 * 2.83], margin: 0 });
        doc.image(posteriorImageBuffer, 0, 0, { width: doc.page.width, height: doc.page.height });

        const fechaVencimiento = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
        doc.fillColor('black').fontSize(7).text(fechaVencimiento, 33, 137, { width: 100, align: 'left' });

        // ==================================================================
        // <-- 1. GENERACIÓN E INCRUSTACIÓN DEL CÓDIGO QR -->
        // ==================================================================
        const urlVerificacion = 'https://quickcontrola.com/verificacion';
        const qrCodeImage = await QRCode.toDataURL(urlVerificacion, {
            errorCorrectionLevel: 'H',
            margin: 1,
            scale: 3 // Un tamaño más pequeño, adecuado para el carnet
        });

        doc.image(qrCodeImage, 180, 25, {
            width: 40
        });
        // ==================================================================

        // Patrón de seguridad en página posterior
        dibujarPatronOndas(doc, { amplitud: 2, frecuencia: 10, espaciado: 4.5, grosor: 0.3 });

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

// Exporta ambos controladores para que estén disponibles en tus rutas
export {
    generarCertificadoController,
    generarCarnetController
};
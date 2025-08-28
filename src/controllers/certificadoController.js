// src/controllers/certificadoController.js

// Importación correcta de node-fetch para módulos ES (ya no lo necesitaremos para certificado, pero lo mantenemos por si el carnet aún lo usa)
import fetch from 'node-fetch';
// Importación de pdfkit para la generación de PDFs
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';


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
    const { nombre, numeroDocumento, tipoDocumento } = req.body;

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

        // Incrustamos la imagen del QR en el PDF
        // Tendrás que ajustar las coordenadas (X, Y) y el tamaño para que encaje en tu diseño
        doc.image(qrCodeImage, 475, 720, { // Posición (X, Y) desde la esquina superior izquierda
            width: 80 // Ancho del QR en el PDF
        });
        // ==================================================================

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
    const { nombre, numeroDocumento, tipoDocumento } = req.body;
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
        doc.fontSize(7).text(numeroDocumento, 75, 73, { width: 150, align: 'left' });

        const fechaActual = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
        doc.fontSize(6).text(fechaActual, 202, 134, { width: 100, align: 'left' });

        // --- Página Posterior del Carnet ---
        doc.addPage({ size: [85.6 * 2.83, 54 * 2.83], margin: 0 });
        doc.image(posteriorImageBuffer, 0, 0, { width: doc.page.width, height: doc.page.height });

        const fechaVencimiento = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
        doc.fillColor('white').fontSize(7).text(fechaVencimiento, 33, 137, { width: 100, align: 'left' });

        // ==================================================================
        // <-- 1. GENERACIÓN E INCRUSTACIÓN DEL CÓDIGO QR -->
        // ==================================================================
        const urlVerificacion = 'https://quickcontrola.com/verificacion';
        const qrCodeImage = await QRCode.toDataURL(urlVerificacion, {
            errorCorrectionLevel: 'H',
            margin: 1,
            scale: 3 // Un tamaño más pequeño, adecuado para el carnet
        });

        // Incrustamos el QR en la parte posterior. Ajusta X, Y y el ancho según tu diseño.
        doc.image(qrCodeImage, 180, 25, { // Posición (X, Y)
            width: 40 // Ancho del QR
        });
        // ==================================================================

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
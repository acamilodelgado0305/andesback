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

        // Dimensiones CR80 estándar en puntos (mismo factor que el diseño original)
        const carnetW = 85.6 * 2.83; // ≈ 242 pt
        const carnetH = 54  * 2.83;  // ≈ 153 pt

        // Una sola hoja A4 con frente y posterior centrados, lista para imprimir y cortar
        const doc = new PDFDocument({ size: 'A4', margin: 0 });
        doc.pipe(res);

        const pageW = doc.page.width;   // 595 pt
        const pageH = doc.page.height;  // 842 pt

        // Centrado horizontal; frente en mitad superior, posterior en mitad inferior
        const cx     = (pageW - carnetW) / 2;
        const frontY = (pageH / 2 - carnetH) / 2;
        const backY  = pageH / 2 + (pageH / 2 - carnetH) / 2;

        // Función de marcas de corte en las 4 esquinas de un carnet
        const drawCropMarks = (x, y, w, h) => {
            const gap = 5;   // separación del borde
            const len = 12;  // longitud de la marca
            doc.save().strokeColor('#999999').lineWidth(0.4);
            // Esquina superior izquierda
            doc.moveTo(x - gap - len, y        ).lineTo(x - gap, y        ).stroke();
            doc.moveTo(x,             y - gap - len).lineTo(x,     y - gap).stroke();
            // Esquina superior derecha
            doc.moveTo(x + w + gap,   y        ).lineTo(x + w + gap + len, y).stroke();
            doc.moveTo(x + w,         y - gap - len).lineTo(x + w, y - gap).stroke();
            // Esquina inferior izquierda
            doc.moveTo(x - gap - len, y + h    ).lineTo(x - gap, y + h    ).stroke();
            doc.moveTo(x,             y + h + gap).lineTo(x,     y + h + gap + len).stroke();
            // Esquina inferior derecha
            doc.moveTo(x + w + gap,   y + h    ).lineTo(x + w + gap + len, y + h).stroke();
            doc.moveTo(x + w,         y + h + gap).lineTo(x + w, y + h + gap + len).stroke();
            doc.restore();
        };

        const frontalImageBuffer  = fs.readFileSync(path.join(__dirname, '..', 'imagenes', 'frontal.png'));
        const posteriorImageBuffer = fs.readFileSync(path.join(__dirname, '..', 'imagenes', 'posterior.png'));

        const fechaActual = new Date().toLocaleDateString('es-CO', {
            year: 'numeric', month: '2-digit', day: '2-digit'
        }).replace(/\//g, '/');

        // ─── CARA FRONTAL ────────────────────────────────────────────────
        doc.image(frontalImageBuffer, cx, frontY, { width: carnetW, height: carnetH });

        if (fotoFile) {
            const fotoBuffer = fs.readFileSync(fotoFile.path);
            doc.image(fotoBuffer, cx + 155, frontY + 40, { width: 65, height: 80 });
        }

        doc.fillColor('black').font('Helvetica')
            .fontSize(7).text(nombre,            cx + 8,   frontY + 60,  { width: 150, align: 'center' })
            .fontSize(7).text(tipoDocumento,     cx + 55,  frontY + 73,  { width: 150, align: 'left'   })
            .fontSize(7).text(numeroDocumento,   cx + 75,  frontY + 73,  { width: 150, align: 'left'   })
            .fontSize(7).text(intensidadHoraria, cx + 92,  frontY + 106, { width: 150, align: 'left'   })
            .fontSize(6).text(fechaActual,       cx + 202, frontY + 134, { width: 100, align: 'left'   });

        drawCropMarks(cx, frontY, carnetW, carnetH);
        doc.fillColor('#888888').fontSize(6)
            .text('FRENTE', cx, frontY - 13, { width: carnetW, align: 'center' });

        // ─── CARA POSTERIOR ──────────────────────────────────────────────
        doc.image(posteriorImageBuffer, cx, backY, { width: carnetW, height: carnetH });

        const fechaVencimiento = new Date(
            new Date().setFullYear(new Date().getFullYear() + 1)
        ).toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');

        doc.fillColor('black').font('Helvetica')
            .fontSize(7).text(fechaVencimiento, cx + 33, backY + 137, { width: 100, align: 'left' });

        const urlVerificacion = 'https://quickcontrola.com/verificacion';
        const qrCodeImage = await QRCode.toDataURL(urlVerificacion, {
            errorCorrectionLevel: 'H',
            margin: 1,
            scale: 3,
        });
        doc.image(qrCodeImage, cx + 180, backY + 25, { width: 40 });

        drawCropMarks(cx, backY, carnetW, carnetH);
        doc.fillColor('#888888').fontSize(6)
            .text('POSTERIOR', cx, backY - 13, { width: carnetW, align: 'center' });

        // ─── Instrucción de impresión ─────────────────────────────────────
        doc.fillColor('#aaaaaa').fontSize(6)
            .text('Imprimir en A4 · Recortar por las marcas · Plastificar',
                0, pageH - 20, { width: pageW, align: 'center' });

        doc.end();
        console.log(`Carnet PDF (A4 listo para imprimir) generado para: ${nombre}`);

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
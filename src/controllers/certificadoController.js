// src/controllers/certificadoController.js

// Importación correcta de node-fetch para módulos ES (ya no lo necesitaremos para certificado, pero lo mantenemos por si el carnet aún lo usa)
import fetch from 'node-fetch';
// Importación de pdfkit para la generación de PDFs
import PDFDocument from 'pdfkit';

// Necesitamos 'fs' y 'path' para leer las imágenes de fondo
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- URLs de tus Web Apps de Google Apps Script ---
// ¡MUY IMPORTANTE! Reemplaza estas URLs con las que obtuviste al desplegar tus scripts.

// URL para el script que genera CERTIFICADOS (YA NO LA USAREMOS PARA EL CERTIFICADO LOCAL)


// //////////////////////////////////////////////////////////////////////////////////
// Controlador para generar un CERTIFICADO
// //////////////////////////////////////////////////////////////////////////////////
const generarCertificadoController = async (req, res) => {
    // Los datos necesarios vienen del cuerpo de la solicitud POST
    // AHORA DESESTRUCTURAMOS 'nombre' EN LUGAR DE 'nombreCliente'
    const { nombre, numeroDocumento, tipoDocumento } = req.body; 
    
    // 1. Validar los campos requeridos
    if (!nombre || !numeroDocumento || !tipoDocumento) {
        return res.status(400).json({ error: 'Nombre, número de documento y tipo de documento son requeridos para generar el certificado.' });
    }

    console.log(`Solicitud de certificado para: ${nombre}, Doc: ${numeroDocumento}, Tipo: ${tipoDocumento}`);

    try {
        // 2. Configurar la respuesta HTTP para un PDF
        // USAMOS 'nombre' PARA EL NOMBRE DEL ARCHIVO TAMBIÉN
        const fileName = `Certificado_${nombre.replace(/\s/g, '_')}_${numeroDocumento}.pdf`; 
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`); 

        // 3. Crear un nuevo documento PDF
        const doc = new PDFDocument({
            size: 'A4', 
            margin: 0, 
        });

        // 4. Conectar el stream del PDF directamente al objeto de respuesta (res)
        doc.pipe(res);

        // Ruta absoluta para la imagen del certificado
        const certificadoImagePath = path.join(__dirname, '..', 'imagenes', 'certificado.png');
        let certificadoImageBuffer;

        // Cargar la imagen como buffer
        try {
            certificadoImageBuffer = fs.readFileSync(certificadoImagePath);
        } catch (readErr) {
            console.error('Error al leer la imagen de fondo del certificado:', readErr);
            if (!res.headersSent) {
                return res.status(500).json({
                    error: 'Error interno del servidor: No se pudo cargar la imagen de fondo del certificado.',
                    details: readErr.message
                });
            }
            doc.end(); 
            return; 
        }

        // --- Añadir la imagen de fondo al certificado ---
        doc.image(certificadoImageBuffer, 0, 0, { width: doc.page.width, height: doc.page.height });

        // Posicionar los datos sobre la imagen
        doc.fillColor('black'); 

        // Fecha actual para el certificado
      const fechaActual = new Date().toLocaleDateString('es-CO', {
            year: 'numeric',
            month: '2-digit', // Formato MM
            day: '2-digit',   // Formato DD
        }).replace(/\//g, '/'); // Asegura el formato DD/MM/YYYY o similar

        // --- Añadir Nombre ---
        // AHORA USAMOS 'nombre' PARA EL TEXTO DEL PDF
        doc.fontSize(15) 
           .font('Helvetica') 
           .text(nombre, 0, 165, { 
               align: 'center', 
               width: doc.page.width, 
           });
        
        // --- Añadir Número de Documento ---
        doc.fontSize(15) 
           .font('Helvetica')
           .text(`${tipoDocumento}: ${numeroDocumento}`, 124, 199, { 
               align: 'center',
               width: doc.page.width,
           });

        // --- Añadir Fecha Actual (Primera vez) ---
        doc.fontSize(14)
           .text(fechaActual, -80, 328, { 
               align: 'center',
               width: doc.page.width,
           });

             doc.fontSize(15)
           .text(fechaActual, -90, 620, { 
               align: 'center',
               width: doc.page.width,
           });

        // --- Añadir Fecha Actual (Segunda vez) ---
      

        // Finalizar el documento y enviarlo a la respuesta
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
    const fotoFile = req.file; // fotoFile será 'undefined' si no se envía foto, y eso está bien.

    try {
        if (!nombre || !numeroDocumento || !tipoDocumento) {
            return res.status(400).json({ error: 'Nombre, número de documento y tipo de documento son requeridos.' });
        }

        // --- CORREGIDO: El console.log ahora es condicional ---
        // Se registra una cosa si hay foto, y otra si no la hay.
        if (fotoFile) {
            console.log(`Solicitud de carnet para: ${nombre} con foto: ${fotoFile.originalname}`);
        } else {
            console.log(`Solicitud de carnet para: ${nombre} (sin foto adjunta).`);
        }

        // --- Configuración del PDF (sin cambios) ---
        const fileName = `Carnet_${nombre.replace(/\s/g, '_')}_${numeroDocumento}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        const doc = new PDFDocument({
            size: [85.6 * 2.83, 54 * 2.83],
            margin: 0,
        });

        doc.pipe(res);

        // --- Carga de imágenes de fondo (sin cambios) ---
        const frontalImagePath = path.join(__dirname, '..', 'imagenes', 'frontal.png');
        const posteriorImagePath = path.join(__dirname, '..', 'imagenes', 'posterior.png');
        const frontalImageBuffer = fs.readFileSync(frontalImagePath);
        const posteriorImageBuffer = fs.readFileSync(posteriorImagePath);

        // --- Página Frontal del Carnet (sin cambios) ---
        doc.image(frontalImageBuffer, 0, 0, { width: doc.page.width, height: doc.page.height });

        // --- ELIMINADO: Se quitó el bloque de código redundante de aquí ---
        // Se eliminó la línea "const fotoBuffer = fs.readFileSync(fotoFile.path);" que causaría el segundo error.

        // --- Lógica para añadir la foto (tu bloque 'if' ya estaba correcto) ---
        // Esta parte solo se ejecuta si 'fotoFile' existe, lo cual es perfecto.
        if (fotoFile) {
            const fotoBuffer = fs.readFileSync(fotoFile.path);
            const fotoOptions = { width: 65, height: 80, align: 'center', valign: 'center' };
            doc.image(fotoBuffer, 155, 40, fotoOptions);
        }

        // --- El resto de la lógica para añadir texto y la página posterior se mantiene igual ---
        doc.fillColor('black');
        doc.fontSize(9).text(nombre, 8, 60, { width: 150, align: 'center' });
        doc.fontSize(7).text(tipoDocumento, 55, 73, { width: 150, align: 'left' });
        doc.fontSize(7).text(numeroDocumento, 75, 73, { width: 150, align: 'left' });

        const fechaActual = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
        doc.fontSize(6).text(fechaActual, 197, 133, { width: 100, align: 'left' });

        doc.addPage({ size: [85.6 * 2.83, 54 * 2.83], margin: 0 });
        doc.image(posteriorImageBuffer, 0, 0, { width: doc.page.width, height: doc.page.height });

        const fechaVencimiento = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
        doc.fillColor('white').fontSize(7).text(fechaVencimiento, 33, 137, { width: 100, align: 'left' });

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
        // Esta parte ya estaba correcta, solo borra el archivo si existe.
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
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
           .text(fechaActual, -80, 620, { 
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
    // MODIFICADO: Los datos de texto vienen de req.body
    const { nombre, numeroDocumento, tipoDocumento } = req.body;
    
    // NUEVO: El archivo de la foto viene de req.file gracias a multer
    const fotoFile = req.file;

    try {
        // 1. Validar los campos requeridos, incluyendo la foto
        if (!nombre || !numeroDocumento || !tipoDocumento) {
            return res.status(400).json({ error: 'Nombre, número de documento y tipo de documento son requeridos.' });
        }
        // NUEVO: Validar que la foto se haya subido
      

        console.log(`Solicitud de carnet para: ${nombre} con foto: ${fotoFile.originalname}`);

        // 2. Configurar la respuesta HTTP para un PDF
        const fileName = `Carnet_${nombre.replace(/\s/g, '_')}_${numeroDocumento}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // 3. Crear un nuevo documento PDF
        const doc = new PDFDocument({
            size: [85.6 * 2.83, 54 * 2.83], // Tamaño carnet en puntos
            margin: 0,
        });

        // 4. Conectar el stream del PDF a la respuesta
        doc.pipe(res);

        // Rutas de las plantillas de fondo
        const frontalImagePath = path.join(__dirname, '..', 'imagenes', 'frontal.png');
        const posteriorImagePath = path.join(__dirname, '..', 'imagenes', 'posterior.png');

        const frontalImageBuffer = fs.readFileSync(frontalImagePath);
        const posteriorImageBuffer = fs.readFileSync(posteriorImagePath);

        // --- Página Frontal del Carnet ---
        doc.image(frontalImageBuffer, 0, 0, { width: doc.page.width, height: doc.page.height });

      
        // =================================================================
        // NUEVO: AÑADIR LA FOTOGRAFÍA DE LA PERSONA
        // =================================================================
        // Leemos la foto que multer subió temporalmente a la carpeta 'uploads'
        const fotoBuffer = fs.readFileSync(fotoFile.path);

        // Define la posición (x, y) y el tamaño (width, height) de la foto en el carnet.
        // ¡¡DEBES AJUSTAR ESTOS VALORES SEGÚN TU DISEÑO!!
        const fotoOptions = {
            width: 65,  // Ancho fijo
            height: 80, // Altura fija
            align: 'center',
            valign: 'center'
        };
        // Coordenadas x, y (esquina superior izquierda donde se pondrá la foto)
           if (fotoFile) {
            const fotoBuffer = fs.readFileSync(fotoFile.path);
            const fotoOptions = { width: 65, height: 80, align: 'center', valign: 'center' };
            doc.image(fotoBuffer, 155, 40, fotoOptions);
        }
        

        // =================================================================

        // Posicionar los datos de texto sobre la imagen frontal
        doc.fillColor('black');

        // Nombre
        doc.fontSize(9).text(nombre, 8, 60, { width: 150, align: 'center' });
        
        // Documento
        doc.fontSize(7).text(tipoDocumento, 55, 73, { width: 150, align: 'left' });
        doc.fontSize(7).text(numeroDocumento, 75, 73, { width: 150, align: 'left' });

        // Fecha de Emisión
        const fechaActual = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
        doc.fontSize(6).text(fechaActual, 197, 133, { width: 100, align: 'left' });
        
        // --- Página Posterior del Carnet ---
        doc.addPage({ size: [85.6 * 2.83, 54 * 2.83], margin: 0 });
        doc.image(posteriorImageBuffer, 0, 0, { width: doc.page.width, height: doc.page.height });

        // Fecha de Vencimiento
        const fechaVencimiento = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
        doc.fillColor('white').fontSize(7).text(fechaVencimiento, 33, 137, { width: 100, align: 'left' });

        // Finalizar el documento
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
        // NUEVO: LIMPIEZA DEL ARCHIVO TEMPORAL
        // Es MUY IMPORTANTE eliminar la foto subida para no saturar el disco del servidor.
        // El bloque 'finally' asegura que esto se ejecute incluso si hay un error.
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
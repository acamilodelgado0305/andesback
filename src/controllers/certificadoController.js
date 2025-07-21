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
    const { nombre, numeroDocumento, tipoDocumento } = req.body;

    // 1. Validar los campos requeridos para el carnet
    if (!nombre || !numeroDocumento || !tipoDocumento) {
        return res.status(400).json({ error: 'Nombre, número de documento y tipo de documento son requeridos para generar el carnet.' });
    }

    console.log(`Solicitud de carnet para: ${nombre}, Doc: ${numeroDocumento}, Tipo: ${tipoDocumento}`);

    try {
        // 2. Configurar la respuesta HTTP para un PDF
        const fileName = `Carnet_${nombre.replace(/\s/g, '_')}_${numeroDocumento}.pdf`; // Reemplaza espacios para un nombre de archivo válido
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`); // 'attachment' para forzar descarga, 'inline' para mostrar en el navegador

        // 3. Crear un nuevo documento PDF
        const doc = new PDFDocument({
            size: [85.6 * 2.83, 54 * 2.83], // Tamaño estándar de un carnet (en puntos: 85.6mm x 54mm)
            margin: 0, // Margen 0 para que la imagen de fondo ocupe todo el espacio
        });

        // 4. Conectar el stream del PDF directamente al objeto de respuesta (res)
        doc.pipe(res);

        // Rutas absolutas para las imágenes
        // Asumiendo que 'imagenes' está al mismo nivel que 'controllers' dentro de 'src'
        const frontalImagePath = path.join(__dirname, '..', 'imagenes', 'frontal.png');
        const posteriorImagePath = path.join(__dirname, '..', 'imagenes', 'posterior.png');

        let frontalImageBuffer;
        let posteriorImageBuffer;

        // Cargar las imágenes como buffers
        try {
            frontalImageBuffer = fs.readFileSync(frontalImagePath);
            posteriorImageBuffer = fs.readFileSync(posteriorImagePath);
        } catch (readErr) {
            console.error('Error al leer las imágenes de fondo:', readErr);
            // Si no se pueden leer las imágenes, puedes enviar un error o un PDF simple
            if (!res.headersSent) {
                return res.status(500).json({
                    error: 'Error interno del servidor: No se pudieron cargar las imágenes de fondo del carnet.',
                    details: readErr.message
                });
            }
            doc.end(); // Asegúrate de finalizar el documento si ya se ha pipeado
            return; // Salir de la función
        }

        // --- Página Frontal del Carnet ---
        doc.image(frontalImageBuffer, 0, 0, { width: doc.page.width, height: doc.page.height });

        // Posicionar los datos sobre la imagen frontal
        // Ajusta estas coordenadas (x, y) y tamaños de fuente según el diseño de tu imagen frontal
        doc.fillColor('black'); // Color del texto

        // Nombre del cliente (Jhony alexander Noriega Méndez)
        doc.fontSize(9) // Puedes ajustar el tamaño de la fuente
            .text(nombre, 8, 60, { // Coordenadas estimadas para el nombre
                width: 150, // Ancho máximo para el texto
                align: 'center'
            });

        // Número de Documento (C.C/1028941528)
        doc.fontSize(7)
            .text(numeroDocumento, 75, 73, { // Coordenadas estimadas para el número de documento
                width: 150,
                align: 'left'
            });

        // Tipo de Documento (Puedes omitirlo si el diseño no lo muestra explícitamente o inferirlo del número)
        doc.fontSize(7).text(tipoDocumento, 55, 73, { width: 150, align: 'left' });

        // Fecha de Emisión (F. EM 16/07/2025)
        const fechaActual = new Date().toLocaleDateString('es-CO', {
            year: 'numeric',
            month: '2-digit', // Formato MM
            day: '2-digit',   // Formato DD
        }).replace(/\//g, '/'); // Asegura el formato DD/MM/YYYY o similar
        doc.fontSize(6)
            .text(fechaActual, 197, 133, { // Coordenadas estimadas para la fecha de emisión
                width: 100,
                align: 'left'
            });

        // --- Página Posterior del Carnet ---
        doc.addPage({
            size: [85.6 * 2.83, 54 * 2.83],
            margin: 0,
        });

        doc.image(posteriorImageBuffer, 0, 0, { width: doc.page.width, height: doc.page.height });

        // Posicionar los datos sobre la imagen posterior (ejemplo, ajusta según tu diseño)
        // Fecha de Vencimiento (VENCE: 16/07/2026)
        const fechaVencimiento = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('es-CO', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).replace(/\//g, '/');
        
        doc.fillColor('white'); // Restablece el color del texto si lo cambiaste
        doc.fontSize(7)
            .text(fechaVencimiento, 33, 137, { // Coordenadas estimadas para la fecha de vencimiento en el reverso
                width: 100,
                align: 'left'
            });
        
        // Puedes añadir aquí otros datos del reverso si tu diseño lo requiere,
        // como los módulos de capacitación, número de contacto, etc.
        // Basado en el PDF de ejemplo, los módulos son parte de la imagen de fondo,
        // pero podrías añadir el número WAAG1282022 y el nombre del firmante si fueran dinámicos.
        // doc.fontSize(8).text('WAAG1282022', X, Y);
        // doc.fontSize(8).text('WILLIAM ARMANDO ALZATE G.', X, Y);


        // Finalizar el documento y enviarlo a la respuesta
        doc.end();

        console.log(`Carnet PDF generado y enviado para: ${nombre}`);

    } catch (err) {
        console.error('Error al generar el carnet:', err);
        // Si ocurre un error, asegúrate de que la respuesta no se haya enviado ya como PDF
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Error interno del servidor al generar el carnet.',
                details: err.message,
            });
        }
    }
};

// Exporta ambos controladores para que estén disponibles en tus rutas
export {
    generarCertificadoController,
    generarCarnetController
};
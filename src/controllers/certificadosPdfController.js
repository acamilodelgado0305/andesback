import PdfPrinter from 'pdfmake';
import moment from 'moment';
import 'moment/locale/es.js';
// Asegúrate de que la ruta sea correcta
import { LOGO_BASE64, FIRMA_SECRETARIA_BASE64, SELLO_BASE64 } from '../utils/certAssets.js';

moment.locale('es');

// Definimos fuentes nativas (Times para elegancia, Helvetica para lectura técnica)
const fonts = {
  Roboto: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  },
  Times: {
    normal: 'Times-Roman',
    bold: 'Times-Bold',
    italics: 'Times-Italic',
    bolditalics: 'Times-BoldItalic'
  }
};

const printer = new PdfPrinter(fonts);

const getFormattedDate = (dateString) => {
    return moment(dateString || new Date()).format('D [de] MMMM [de] YYYY');
};

export const generarCertificadoPDF = async (req, res) => {
    try {
        const { nombre, numeroDocumento, tipoDocumento, curso, fechaFinalizacion } = req.body;

        if (!nombre || !numeroDocumento) {
            return res.status(400).json({ error: "Faltan datos del estudiante." });
        }

        // Datos procesados
        const nombreCurso = curso || "CURSO DE FORMACIÓN PROFESIONAL";
        const nombreEstudiante = nombre.toUpperCase();
        const documentoCompleto = `${tipoDocumento || 'C.C.'} ${numeroDocumento}`;
        const fechaEmision = getFormattedDate(fechaFinalizacion);
        const folioId = `CERT-${Math.floor(Math.random() * 100000)}-${new Date().getFullYear()}`;

        // --- DEFINICIÓN DEL PDF (Estilo "Diploma Universitario") ---
        const docDefinition = {
            pageSize: 'A4',
            pageOrientation: 'landscape',
            // Márgenes amplios [Izq, Arr, Der, Aba] para dar aire
            pageMargins: [60, 50, 60, 40],

            // FONDO DECORATIVO (Marco doble)
            background: function(currentPage, pageSize) {
                return [
                    {
                        canvas: [
                            // Marco Exterior (Azul Oscuro)
                            {
                                type: 'rect',
                                x: 15, y: 15,
                                w: pageSize.width - 30,
                                h: pageSize.height - 30,
                                lineWidth: 3,
                                lineColor: '#0a1f44' 
                            },
                            // Marco Interior (Dorado Fino)
                            {
                                type: 'rect',
                                x: 22, y: 22,
                                w: pageSize.width - 44,
                                h: pageSize.height - 44,
                                lineWidth: 1,
                                lineColor: '#c5a059' 
                            }
                        ]
                    }
                ];
            },

            content: [
                // 1. Encabezado Institucional
                {
                    image: LOGO_BASE64,
                    width: 70,
                    alignment: 'center',
                    margin: [0, 0, 0, 15]
                },
                { 
                    text: 'FUNDACIÓN EDUCATIVA VILLA DE LOS ANDES', 
                    style: 'universityName' 
                },
                { 
                    text: 'Excelencia y Formación Profesional', 
                    style: 'slogan',
                    margin: [0, 5, 0, 30]
                },

                // 2. Texto de Otorgamiento
                { 
                    text: 'Certifica que:', 
                    style: 'certifiesText' 
                },

                // 3. Nombre del Estudiante (El protagonista)
                { 
                    text: nombreEstudiante, 
                    style: 'studentName' 
                },
                
                // Línea separadora dorada debajo del nombre
                {
                    canvas: [{ type: 'line', x1: 200, y1: 0, x2: 600, y2: 0, lineWidth: 1, lineColor: '#c5a059' }],
                    alignment: 'center',
                    margin: [0, 5, 0, 10]
                },

                { 
                    text: `Con identificación ${documentoCompleto}`, 
                    style: 'documentId' 
                },

                // 4. Detalle del Logro
                { 
                    text: 'Ha cursado y aprobado satisfactoriamente el programa de:', 
                    style: 'bodyText',
                    margin: [0, 20, 0, 10]
                },

                { 
                    text: nombreCurso.toUpperCase(), 
                    style: 'courseTitle' 
                },

                { 
                    text: 'Con una intensidad de 40 horas teórico-prácticas.', 
                    style: 'detailsText',
                    margin: [0, 5, 0, 40]
                },

                // 5. SECCIÓN DE FIRMAS (Corregida para que no se descuadre)
                {
                    columns: [
                        {
                            // Columna Izquierda: Secretaria
                            width: '*',
                            stack: [
                                { 
                                    image: FIRMA_SECRETARIA_BASE64, 
                                    width: 130, // Ajusta según tu imagen real
                                    alignment: 'center',
                                    margin: [0, 0, 0, -10] // Truco para acercar la firma a la línea
                                },
                                { 
                                    canvas: [{ type: 'line', x1: 40, y1: 0, x2: 240, y2: 0, lineWidth: 1, lineColor: '#333333' }], 
                                    alignment: 'center',
                                    margin: [0, 5, 0, 5]
                                },
                                { text: 'SECRETARÍA ACADÉMICA', style: 'sigName' },
                                { text: 'Registro y Control', style: 'sigRole' }
                            ]
                        },
                        {
                            // Columna Central: Sello (Opcional, decorativo)
                            width: 100,
                            stack: [
                                {
                                    image: SELLO_BASE64,
                                    width: 90,
                                    alignment: 'center',
                                    opacity: 0.8
                                }
                            ]
                        },
                        {
                            // Columna Derecha: Docente
                            width: '*',
                            stack: [
                                // Si no hay firma imagen, usamos texto cursivo simulado
                                { 
                                    text: 'Andrés Delgado', 
                                    font: 'Times', 
                                    italics: true, 
                                    fontSize: 22, 
                                    alignment: 'center',
                                    margin: [0, 0, 0, 5]
                                },
                                { 
                                    canvas: [{ type: 'line', x1: 40, y1: 0, x2: 240, y2: 0, lineWidth: 1, lineColor: '#333333' }], 
                                    alignment: 'center',
                                    margin: [0, 5, 0, 5]
                                },
                                { text: 'ANDRÉS CAMILO DELGADO', style: 'sigName' },
                                { text: 'Docente / Capacitador', style: 'sigRole' }
                            ]
                        }
                    ],
                    columnGap: 20
                },

                // 6. Footer Técnico
                {
                    text: [
                        { text: 'Fecha de expedición: ', bold: true },
                        `${fechaEmision}  |  `,
                        { text: 'Folio de Verificación: ', bold: true },
                        `${folioId}`
                    ],
                    style: 'footerText',
                    absolutePosition: { x: 60, y: 530 } // Fijo al final
                }
            ],

            // ESTILOS (La clave de la elegancia)
            styles: {
                universityName: {
                    font: 'Times',
                    fontSize: 24,
                    bold: true,
                    alignment: 'center',
                    color: '#0a1f44', // Azul oscuro
                    characterSpacing: 1
                },
                slogan: {
                    font: 'Times',
                    fontSize: 11,
                    italics: true,
                    alignment: 'center',
                    color: '#c5a059' // Dorado
                },
                certifiesText: {
                    font: 'Times',
                    fontSize: 14,
                    italics: true,
                    alignment: 'center',
                    color: '#555555',
                    margin: [0, 0, 0, 10]
                },
                studentName: {
                    font: 'Times',
                    fontSize: 32, // Tamaño grande para el nombre
                    bold: true,
                    alignment: 'center',
                    color: '#000000'
                },
                documentId: {
                    font: 'Roboto', // Sans-serif para números es mejor
                    fontSize: 10,
                    alignment: 'center',
                    color: '#666666'
                },
                bodyText: {
                    font: 'Times',
                    fontSize: 14,
                    alignment: 'center',
                    color: '#333333'
                },
                courseTitle: {
                    font: 'Times',
                    fontSize: 26,
                    bold: true,
                    alignment: 'center',
                    color: '#0a1f44',
                    margin: [0, 5, 0, 5]
                },
                detailsText: {
                    font: 'Times',
                    fontSize: 12,
                    italics: true,
                    alignment: 'center',
                    color: '#555555'
                },
                sigName: {
                    font: 'Roboto',
                    fontSize: 10,
                    bold: true,
                    alignment: 'center',
                    color: '#333333',
                    uppercase: true
                },
                sigRole: {
                    font: 'Roboto',
                    fontSize: 9,
                    alignment: 'center',
                    color: '#777777',
                    margin: [0, 2, 0, 0] // Espacio pequeño arriba
                },
                footerText: {
                    font: 'Roboto',
                    fontSize: 8,
                    alignment: 'center',
                    color: '#999999'
                }
            }
        };

        // Generar PDF
        const pdfDoc = printer.createPdfKitDocument(docDefinition);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Diploma_${numeroDocumento}.pdf"`);

        pdfDoc.pipe(res);
        pdfDoc.end();

    } catch (error) {
        console.error("Error al generar diploma:", error);
        res.status(500).json({ error: "Error interno al generar el documento." });
    }
};
import PdfPrinter from 'pdfmake';
import moment from 'moment';
import 'moment/locale/es.js';
import QRCode from 'qrcode';
// Asegúrate de que la ruta sea correcta
import { LOGO_BASE64, FIRMA_SECRETARIA_BASE64, FIRMA_CAPACITADOR_BASE64, SELLO_BASE64 } from '../utils/certAssets.js';

moment.locale('es');

// ── Paleta institucional ──────────────────────────────────────────────
const NAVY = '#0a1f44'; // Azul institucional profundo
const GOLD = '#b8912f'; // Dorado de acentos
const GOLD_SOFT = '#c5a059'; // Dorado claro (filetes)
const INK = '#1a1a1a';
const MUTED = '#555555';
const MUTED_2 = '#777777';

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

// Dibuja el marco ornamental + esquineros + marca de agua. Se centraliza aquí
// para mantener el diseño consistente en toda la página.
const buildBackground = (currentPage, pageSize) => {
    const W = pageSize.width;
    const H = pageSize.height;
    const b = 40;   // separación de los esquineros respecto al borde
    const L = 26;   // largo de cada esquinero
    const r = 3.5;  // radio de los rombos

    const diamond = (cx, cy) => ({
        type: 'polyline',
        closePath: true,
        color: GOLD,
        points: [
            { x: cx, y: cy - r }, { x: cx + r, y: cy },
            { x: cx, y: cy + r }, { x: cx - r, y: cy }
        ]
    });

    return [
        // Marca de agua: sello institucional muy tenue, centrado
        {
            image: SELLO_BASE64,
            width: 330,
            opacity: 0.05,
            absolutePosition: { x: (W - 330) / 2, y: (H - 330) / 2 }
        },
        {
            canvas: [
                // Marco exterior (azul oscuro)
                { type: 'rect', x: 18, y: 18, w: W - 36, h: H - 36, lineWidth: 2.5, lineColor: NAVY },
                // Marco medio (dorado)
                { type: 'rect', x: 25, y: 25, w: W - 50, h: H - 50, lineWidth: 1.2, lineColor: GOLD_SOFT },
                // Marco interior fino (azul)
                { type: 'rect', x: 29, y: 29, w: W - 58, h: H - 58, lineWidth: 0.5, lineColor: NAVY },

                // Esquineros dorados (corchetes en las 4 esquinas)
                { type: 'line', x1: b, y1: b, x2: b + L, y2: b, lineWidth: 1.5, lineColor: GOLD },
                { type: 'line', x1: b, y1: b, x2: b, y2: b + L, lineWidth: 1.5, lineColor: GOLD },
                { type: 'line', x1: W - b, y1: b, x2: W - b - L, y2: b, lineWidth: 1.5, lineColor: GOLD },
                { type: 'line', x1: W - b, y1: b, x2: W - b, y2: b + L, lineWidth: 1.5, lineColor: GOLD },
                { type: 'line', x1: b, y1: H - b, x2: b + L, y2: H - b, lineWidth: 1.5, lineColor: GOLD },
                { type: 'line', x1: b, y1: H - b, x2: b, y2: H - b - L, lineWidth: 1.5, lineColor: GOLD },
                { type: 'line', x1: W - b, y1: H - b, x2: W - b - L, y2: H - b, lineWidth: 1.5, lineColor: GOLD },
                { type: 'line', x1: W - b, y1: H - b, x2: W - b, y2: H - b - L, lineWidth: 1.5, lineColor: GOLD },

                // Rombos dorados en las esquinas
                diamond(b, b), diamond(W - b, b), diamond(b, H - b), diamond(W - b, H - b),
            ]
        }
    ];
};

// Construye la definición del diploma (pdfmake). Centraliza el diseño para que
// tanto el endpoint de descarga como la generación automática al graduar usen
// exactamente la misma plantilla.
const buildDiplomaDefinition = ({
    nombre, numeroDocumento, tipoDocumento, curso, horas, fechaFinalizacion, folio,
    secretariaNombre, secretariaRol,
    docenteNombre, docenteRol, docenteFirmaTexto,
    nit,
    qrDataUrl,
}) => {
    const nombreCurso = curso || "CURSO DE FORMACIÓN PROFESIONAL";
    const nitInstitucion = nit || '900.573.053-3';
    // Normaliza espacios (colapsa dobles espacios de datos con apellido/nombre sucios)
    const nombreEstudiante = String(nombre).replace(/\s+/g, ' ').trim().toUpperCase();
    const documentoCompleto = `${tipoDocumento || 'C.C.'} ${numeroDocumento}`;
    const fechaEmision = getFormattedDate(fechaFinalizacion);
    const folioId = folio || `CERT-${Math.floor(Math.random() * 100000)}-${new Date().getFullYear()}`;
    const horasNum = horas != null && horas !== '' ? Number(horas) : null;
    const intensidadTexto = horasNum
        ? `Con una intensidad de ${horasNum} horas teórico-prácticas.`
        : 'Programa de formación teórico-práctica.';

    // Firmantes (con valores por defecto retrocompatibles)
    const secNombre = secretariaNombre || 'SECRETARÍA ACADÉMICA';
    const secRol = secretariaRol || 'Registro y Control';
    const docNombre = docenteNombre || 'ANDRÉS CAMILO DELGADO';
    const docRol = docenteRol || 'Docente / Capacitador';
    const docFirma = docenteFirmaTexto || 'Andrés Delgado';

    // Filete dorado corto (reutilizable) para el eyebrow
    const filete = () => ({
        canvas: [{ type: 'line', x1: 0, y1: 5, x2: 55, y2: 5, lineWidth: 1, lineColor: GOLD }],
        width: 'auto'
    });

    return {
            pageSize: 'A4',
            pageOrientation: 'landscape',
            // Márgenes amplios [Izq, Arr, Der, Aba] para dar aire
            pageMargins: [70, 38, 70, 34],

            background: buildBackground,

            content: [
                // 1. Encabezado institucional
                {
                    image: LOGO_BASE64,
                    width: 54,
                    alignment: 'center',
                    margin: [0, 0, 0, 8]
                },
                {
                    text: 'FUNDACIÓN EDUCATIVA VILLA DE LOS ANDES',
                    style: 'universityName'
                },
                {
                    text: 'Excelencia y Formación Profesional',
                    style: 'slogan',
                    margin: [0, 4, 0, 2]
                },
                {
                    text: `NIT ${nitInstitucion}`,
                    style: 'nit',
                    margin: [0, 0, 0, 10]
                },

                // 2. Eyebrow: título del documento con filetes dorados
                {
                    columns: [
                        { width: '*', text: '' },
                        filete(),
                        { width: 'auto', noWrap: true, text: 'CERTIFICADO DE APROBACIÓN', style: 'eyebrow', margin: [12, 0, 12, 0] },
                        filete(),
                        { width: '*', text: '' },
                    ],
                    margin: [0, 0, 0, 12]
                },

                // 3. Texto de otorgamiento
                {
                    text: 'La institución hace constar que:',
                    style: 'certifiesText'
                },

                // 4. Nombre del estudiante (protagonista)
                {
                    text: nombreEstudiante,
                    style: 'studentName'
                },

                // Línea separadora dorada debajo del nombre
                {
                    canvas: [{ type: 'line', x1: 220, y1: 0, x2: 620, y2: 0, lineWidth: 1, lineColor: GOLD_SOFT }],
                    alignment: 'center',
                    margin: [0, 3, 0, 6]
                },

                {
                    text: `Identificado(a) con ${documentoCompleto}`,
                    style: 'documentId'
                },

                // 5. Detalle del logro
                {
                    text: 'Ha cursado y aprobado satisfactoriamente el programa de:',
                    style: 'bodyText',
                    margin: [0, 14, 0, 6]
                },

                {
                    text: nombreCurso.toUpperCase(),
                    style: 'courseTitle'
                },

                {
                    text: intensidadTexto,
                    style: 'detailsText',
                    margin: [0, 4, 0, 22]
                },

                // 6. Sección de firmas (secretaría · sello · docente)
                // Ambas firmas usan la MISMA altura (fit) para que las líneas y
                // los nombres queden alineados exactamente al mismo nivel.
                {
                    columns: [
                        {
                            width: '*',
                            stack: [
                                {
                                    image: FIRMA_SECRETARIA_BASE64,
                                    fit: [190, 50],
                                    alignment: 'center',
                                    margin: [0, 0, 0, 2]
                                },
                                {
                                    canvas: [{ type: 'line', x1: 30, y1: 0, x2: 230, y2: 0, lineWidth: 0.8, lineColor: '#333333' }],
                                    alignment: 'center',
                                    margin: [0, 4, 0, 5]
                                },
                                { text: secNombre, style: 'sigName' },
                                { text: secRol, style: 'sigRole' }
                            ]
                        },
                        {
                            width: 110,
                            stack: [
                                {
                                    image: SELLO_BASE64,
                                    width: 84,
                                    alignment: 'center',
                                    opacity: 0.92
                                }
                            ]
                        },
                        {
                            width: '*',
                            stack: [
                                {
                                    image: FIRMA_CAPACITADOR_BASE64,
                                    fit: [190, 50],
                                    alignment: 'center',
                                    margin: [0, 0, 0, 2]
                                },
                                {
                                    canvas: [{ type: 'line', x1: 30, y1: 0, x2: 230, y2: 0, lineWidth: 0.8, lineColor: '#333333' }],
                                    alignment: 'center',
                                    margin: [0, 4, 0, 5]
                                },
                                { text: docNombre, style: 'sigName' },
                                { text: docRol, style: 'sigRole' }
                            ]
                        }
                    ],
                    columnGap: 20
                },

                // Filete dorado separador antes del footer
                {
                    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 702, y2: 0, lineWidth: 0.5, lineColor: GOLD_SOFT }],
                    margin: [0, 16, 0, 8]
                },

                // 7. Footer: datos de expedición + QR de verificación
                {
                    columns: [
                        {
                            width: '*',
                            stack: [
                                {
                                    text: [
                                        { text: 'Fecha de expedición: ', bold: true, color: MUTED },
                                        { text: `${fechaEmision}`, color: MUTED_2 },
                                    ],
                                    style: 'footerText'
                                },
                                {
                                    text: [
                                        { text: 'Folio de verificación: ', bold: true, color: MUTED },
                                        { text: `${folioId}`, color: MUTED_2 },
                                    ],
                                    style: 'footerText',
                                    margin: [0, 2, 0, 0]
                                },
                                {
                                    text: 'Documento con validez institucional. Verifique su autenticidad escaneando el código QR.',
                                    style: 'footerNote',
                                    margin: [0, 3, 0, 0]
                                },
                            ],
                            margin: [0, 2, 0, 0]
                        },
                        qrDataUrl
                            ? {
                                width: 66,
                                stack: [
                                    { image: qrDataUrl, width: 58, alignment: 'right' },
                                    { text: 'Verificar', style: 'qrCaption', alignment: 'right', margin: [0, 2, 0, 0] },
                                ]
                            }
                            : { width: 66, text: '' },
                    ],
                    columnGap: 16
                }
            ],

            // ESTILOS
            styles: {
                universityName: {
                    font: 'Times',
                    fontSize: 22,
                    bold: true,
                    alignment: 'center',
                    color: NAVY,
                    characterSpacing: 1
                },
                slogan: {
                    font: 'Times',
                    fontSize: 11,
                    italics: true,
                    alignment: 'center',
                    color: GOLD
                },
                nit: {
                    font: 'Roboto',
                    fontSize: 8.5,
                    alignment: 'center',
                    color: MUTED_2,
                    characterSpacing: 0.5
                },
                eyebrow: {
                    font: 'Roboto',
                    fontSize: 11,
                    bold: true,
                    color: NAVY,
                    characterSpacing: 3
                },
                certifiesText: {
                    font: 'Times',
                    fontSize: 14,
                    italics: true,
                    alignment: 'center',
                    color: MUTED,
                    margin: [0, 0, 0, 8]
                },
                studentName: {
                    font: 'Times',
                    fontSize: 31,
                    bold: true,
                    alignment: 'center',
                    color: INK,
                    characterSpacing: 0.5
                },
                documentId: {
                    font: 'Roboto',
                    fontSize: 10,
                    alignment: 'center',
                    color: MUTED_2
                },
                bodyText: {
                    font: 'Times',
                    fontSize: 14,
                    alignment: 'center',
                    color: '#333333'
                },
                courseTitle: {
                    font: 'Times',
                    fontSize: 24,
                    bold: true,
                    alignment: 'center',
                    color: NAVY,
                    margin: [0, 4, 0, 4]
                },
                detailsText: {
                    font: 'Times',
                    fontSize: 12,
                    italics: true,
                    alignment: 'center',
                    color: MUTED
                },
                sigName: {
                    font: 'Roboto',
                    fontSize: 10,
                    bold: true,
                    alignment: 'center',
                    color: '#333333'
                },
                sigRole: {
                    font: 'Roboto',
                    fontSize: 9,
                    alignment: 'center',
                    color: MUTED_2,
                    margin: [0, 2, 0, 0]
                },
                footerText: {
                    font: 'Roboto',
                    fontSize: 8.5,
                    alignment: 'left'
                },
                footerNote: {
                    font: 'Roboto',
                    fontSize: 7.5,
                    italics: true,
                    color: '#999999',
                    alignment: 'left'
                },
                qrCaption: {
                    font: 'Roboto',
                    fontSize: 7,
                    bold: true,
                    color: MUTED_2,
                    characterSpacing: 1
                }
            }
        };
};

// Construye el contenido del QR de verificación. Si existe CERT_VERIFY_BASE_URL,
// apunta a la página pública de verificación; si no, embebe un texto verificable.
const buildQrPayload = ({ folioId, documentoCompleto, nombreEstudiante, nombreCurso }) => {
    const base = process.env.CERT_VERIFY_BASE_URL;
    if (base) {
        const sep = base.includes('?') ? '&' : '?';
        return `${base}${sep}folio=${encodeURIComponent(folioId)}`;
    }
    return [
        'CERTIFICADO VERIFICABLE',
        'Fundación Educativa Villa de los Andes',
        `Folio: ${folioId}`,
        `Documento: ${documentoCompleto}`,
        `Nombre: ${nombreEstudiante}`,
        `Programa: ${nombreCurso}`,
    ].join('\n');
};

// Genera el diploma y lo devuelve como Buffer (para subir a GCS / adjuntar).
export const generarDiplomaBuffer = async (data) => {
    // Prepara el QR de verificación antes de armar la definición del documento.
    const folioId = data.folio || `CERT-${Math.floor(Math.random() * 100000)}-${new Date().getFullYear()}`;
    const documentoCompleto = `${data.tipoDocumento || 'C.C.'} ${data.numeroDocumento}`;
    const nombreEstudiante = String(data.nombre || '').toUpperCase();
    const nombreCurso = data.curso || 'CURSO DE FORMACIÓN PROFESIONAL';

    let qrDataUrl = null;
    try {
        const payload = buildQrPayload({ folioId, documentoCompleto, nombreEstudiante, nombreCurso });
        qrDataUrl = await QRCode.toDataURL(payload, {
            margin: 0,
            width: 240,
            errorCorrectionLevel: 'M',
            color: { dark: NAVY, light: '#ffffff' },
        });
    } catch (qrErr) {
        // Si el QR falla, el diploma se genera igual (sin QR).
        console.error('No se pudo generar el QR del diploma:', qrErr);
    }

    return new Promise((resolve, reject) => {
        try {
            const docDefinition = buildDiplomaDefinition({ ...data, folio: folioId, qrDataUrl });
            const pdfDoc = printer.createPdfKitDocument(docDefinition);
            const chunks = [];
            pdfDoc.on('data', (chunk) => chunks.push(chunk));
            pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
            pdfDoc.on('error', reject);
            pdfDoc.end();
        } catch (err) {
            reject(err);
        }
    });
};

// Endpoint: genera el diploma y lo descarga como PDF.
export const generarCertificadoPDF = async (req, res) => {
    try {
        const { nombre, numeroDocumento, tipoDocumento, curso, horas, fechaFinalizacion } = req.body;

        if (!nombre || !numeroDocumento) {
            return res.status(400).json({ error: "Faltan datos del estudiante." });
        }

        const pdfBuffer = await generarDiplomaBuffer({
            nombre, numeroDocumento, tipoDocumento, curso, horas, fechaFinalizacion,
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Diploma_${numeroDocumento}.pdf"`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error("Error al generar diploma:", error);
        res.status(500).json({ error: "Error interno al generar el documento." });
    }
};

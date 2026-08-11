// src/controllers/diplomaController.js
//
// Diploma + constancia de Alianza Capacitarte. Son la MISMA acreditación en dos
// piezas: el diploma (carta apaisada, para enmarcar) y la constancia (A4 vertical,
// con el registro en libro/folio).
//
// Las coordenadas del diploma salen del .pptx original
// ("DIPLOMA ALIANZA CAPACITARTE 2025"), 720 x 540 pt = carta apaisada.
// La constancia se rediseñó desde cero sobre el membrete del .docx.

import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import {
    dibujarPatronOndas,
    formatFechaDDMMYYYY,
    partesFechaLarga,
    ajustarAUnaLinea,
} from '../utils/pdfHelpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMG = (nombre) => path.join(__dirname, '..', 'imagenes', nombre);

// Datos fijos de la institución. Si cambian el representante legal o el NIT,
// se editan aquí y se reflejan en las dos piezas.
const INSTITUCION = {
    nombre: 'ALIANZA CAPACITARTE',
    nit: '1017174588-8',
    // Libro de constancias vigente. El folio ya no se lleva a mano: se genera
    // automático (UUID) por acreditación, así que esto cambia rara vez.
    libro: '010',
    representante: 'Sandra Milena Mazo',
    tarjetaProfesional: '25-3163',
    telefono: '3012307470',
    correo: 'alianzapacitarte@gmail.com',
    ciudad: 'Medellín',
    urlVerificacion: 'https://www.alianzacapacitarte.com/verificacion.html',
};

const MARCO_LEGAL = 'EN CUMPLIMIENTO CON LOS REQUISITOS LEGALES ESTABLECIDOS EN LOS ARTICULO 2, 6, 8 DEL DECRETO 1075 DE MAYO 26 DE 2015';

// Los ítems del inventario suelen venir ya nombrados con su tipo ("Diplomado
// Limpieza y Desinfección", "Curso de Alturas", "Técnico en…"). Anteponer a ciegas
// "el Diplomado En" produce "el Diplomado En Diplomado Limpieza…", así que solo se
// añade el sustantivo cuando el nombre no lo trae.
const YA_TIENE_TIPO = /^(diplomado|curso|t[eé]cnico|taller|seminario|programa)\b/i;

const fraseDiploma = (curso) => {
    const c = String(curso || '').trim();
    return YA_TIENE_TIPO.test(c)
        ? `Asistió y Aprobó el ${c}`
        : `Asistió y Aprobó el Diplomado En ${c}`;
};

const fraseConstancia = (curso) => {
    const c = String(curso || '').trim();
    return YA_TIENE_TIPO.test(c)
        ? `Asistió y Aprobó el ${c}`
        : `Asistió y Aprobó el curso ${c}`;
};

// Dibuja una línea centrada compuesta por tramos con distinta fuente/tamaño.
// pdfkit no sirve para esto con `continued: true` + `align: 'center'`: centra
// cada tramo por separado y los superpone. Aquí se mide el total y se posiciona
// tramo a tramo desde la izquierda.
const lineaCentradaMixta = (doc, partes, centroX, y) => {
    const anchos = partes.map(p => doc.font(p.font).fontSize(p.size).widthOfString(p.text));
    const total = anchos.reduce((a, b) => a + b, 0);
    let x = centroX - total / 2;

    partes.forEach((p, i) => {
        // Alinea por la base para que tramos de distinto tamaño no "bailen".
        const maxSize = Math.max(...partes.map(q => q.size));
        doc.font(p.font).fontSize(p.size).text(p.text, x, y + (maxSize - p.size) * 0.72, { lineBreak: false });
        x += anchos[i];
    });
};


// ──────────────────────────────────────────────────────────────────────────
// DIPLOMA (carta apaisada, 720 x 540 pt)
// ──────────────────────────────────────────────────────────────────────────

const dibujarDiploma = async (doc, datos) => {
    const {
        nombre, numeroDocumento, tipoDocumento, curso,
        intensidadHoraria, fechaInicio, fechaFin,
        fechaExpedicion, libro, folio,
    } = datos;

    doc.image(fs.readFileSync(IMG('diploma_fondo.jpg')), 0, 0, {
        width: doc.page.width,
        height: doc.page.height,
    });

    doc.fillColor('black');

    // Título de la institución. El escudo del fondo termina en y≈150 ("Libertad
    // y Orden"), así que el título arranca debajo o se pisan.
    doc.font('Times-Bold').fontSize(28)
        .text(INSTITUCION.nombre, 121, 156, { width: 471, align: 'center' });

    // Marco legal (dos líneas)
    doc.font('Helvetica-Oblique').fontSize(12)
        .text(MARCO_LEGAL, 61, 194, { width: 598, align: 'center' });

    doc.font('Helvetica-BoldOblique').fontSize(14)
        .text('HACE CONSTAR QUE:', 67, 233, { width: 575, align: 'center' });

    // Estudiante
    doc.font('Helvetica-Bold').fontSize(18)
        .text(nombre, 67, 264, { width: 575, align: 'center' });

    lineaCentradaMixta(doc, [
        { text: 'Documento de identificación: ', font: 'Helvetica', size: 16 },
        { text: String(numeroDocumento), font: 'Helvetica-Bold', size: 18 },
    ], 354, 290);

    // Curso: única línea, se encoge antes que desbordar sobre las fechas.
    const { texto, size } = ajustarAUnaLinea(doc, fraseDiploma(curso), 660, 18, 11);
    doc.font('Helvetica-Bold').fontSize(size)
        .text(texto, 30, 325, { width: 660, align: 'center', lineBreak: false });

    const { dia, mes, anio } = partesFechaLarga(fechaExpedicion);

    // Bloque de cierre: cuatro renglones a 13-18pt de distancia. NINGUNO puede
    // envolver — la segunda línea caería encima del siguiente renglón. Por eso
    // todos van con ajustarAUnaLinea + lineBreak:false y no con `width` a secas.
    const cierre = [
        {
            texto: `INICIO ${formatFechaDDMMYYYY(fechaInicio)}     FINALIZO ${formatFechaDDMMYYYY(fechaFin)}     DURACION DE ${intensidadHoraria} HORAS`,
            y: 363, font: 'Helvetica-BoldOblique', size: 12, min: 8,
        },
        {
            texto: `En testimonio de lo anterior, se firma el presente en ${INSTITUCION.ciudad}, a los ${dia} días del mes de ${mes} del ${anio}`,
            y: 381, font: 'Helvetica-Oblique', size: 11, min: 7.5,
        },
        {
            texto: `Registrado en el libro de constancias No ${libro} folio ${folio} con fecha (${formatFechaDDMMYYYY(fechaExpedicion)})`,
            y: 397, font: 'Helvetica', size: 10.5, min: 6.5,
        },
        {
            texto: `Para más información ${INSTITUCION.telefono} correo ${INSTITUCION.correo}`,
            y: 411, font: 'Helvetica', size: 10.5, min: 7,
        },
    ];

    cierre.forEach((l) => {
        const ajustado = ajustarAUnaLinea(doc, l.texto, 640, l.size, l.min, l.font);
        doc.font(l.font).fontSize(ajustado.size)
            .text(ajustado.texto, 40, l.y, { width: 640, align: 'center', lineBreak: false });
    });

    // Firma y sello
    doc.image(fs.readFileSync(IMG('firma.png')), 280, 423, { width: 152, height: 56 });
    doc.image(fs.readFileSync(IMG('sello.png')), 513, 424, { width: 86, height: 86 });

    doc.font('Helvetica-Bold').fontSize(14).fillColor('black')
        .text(`${INSTITUCION.representante} NIT ${INSTITUCION.nit}`, 44, 476, { width: 650, align: 'center' })
        .text('Representante Legal', 44, 493, { width: 650, align: 'center' })
        .text(`Capacitador  TP: ${INSTITUCION.tarjetaProfesional}`, 44, 510, { width: 650, align: 'center' });

    dibujarPatronOndas(doc, { espaciado: 11, amplitud: 3.5, opacidad: 0.04 });

    // Tipo de documento no se imprime en el diploma (va en la constancia); se
    // acepta en el payload para mantener una sola firma de datos.
    void tipoDocumento;
};

// ──────────────────────────────────────────────────────────────────────────
// CONSTANCIA / CERTIFICADO (A4 vertical)
// ──────────────────────────────────────────────────────────────────────────

// Paleta tomada del fondo del diploma (muestreada pixel a pixel sobre
// diploma_fondo.jpg) para que las dos piezas se vean de la misma familia.
const PALETA = {
    navy: '#133165',
    navyOscuro: '#112957',
    teal: '#1f98b3',
    tealOscuro: '#1d7990',
    dorado: '#c7ac67',
    texto: '#1f2937',
    textoSuave: '#4b5563',
};

// Marco decorativo azul/dorado en vectores. El fondo del diploma es apaisado y
// trae el escudo incrustado, así que en A4 vertical no sirve como imagen: se
// redibuja con curvas, respetando el orden de capas del original
// (teal al fondo → filete dorado → navy encima).
const dibujarMarcoAlianza = (doc) => {
    const W = doc.page.width;
    const H = doc.page.height;

    // Una banda = [profundidad en el borde derecho, profundidad en el izquierdo]
    const banda = (yBase, signo, profDer, profIzq, color) => {
        doc.save().fillColor(color);
        doc.moveTo(0, yBase).lineTo(W, yBase).lineTo(W, yBase + signo * profDer);
        doc.bezierCurveTo(
            W * 0.66, yBase + signo * profDer * 1.55,
            W * 0.32, yBase + signo * profIzq * 0.45,
            0, yBase + signo * profIzq
        );
        doc.closePath().fill().restore();
    };

    const filete = (yBase, signo, profDer, profIzq) => {
        doc.save().lineWidth(1.8).strokeColor(PALETA.dorado);
        doc.moveTo(W, yBase + signo * profDer);
        doc.bezierCurveTo(
            W * 0.66, yBase + signo * profDer * 1.55,
            W * 0.32, yBase + signo * profIzq * 0.45,
            0, yBase + signo * profIzq
        );
        doc.stroke().restore();
    };

    // Superior: la banda es más gruesa a la izquierda (igual que el diploma)
    banda(0, 1, 42, 66, PALETA.teal);
    filete(0, 1, 30, 52);
    banda(0, 1, 27, 49, PALETA.navy);

    // Inferior: espejada y con el grosor invertido, para dar ritmo diagonal
    banda(H, -1, 64, 40, PALETA.tealOscuro);
    filete(H, -1, 50, 28);
    banda(H, -1, 47, 25, PALETA.navyOscuro);
};

const dibujarConstancia = async (doc, datos) => {
    const {
        nombre, numeroDocumento, tipoDocumento, curso,
        intensidadHoraria, fechaInicio, fechaFin,
        fechaExpedicion, libro, folio,
    } = datos;

    const W = doc.page.width;   // 595.28
    const H = doc.page.height;  // 841.89
    const MX = 58;              // margen lateral
    const ANCHO = W - MX * 2;

    dibujarMarcoAlianza(doc);

    // Marca de agua centrada, muy tenue
    doc.save().opacity(0.06);
    doc.image(fs.readFileSync(IMG('marca_agua.png')), W / 2 - 150, H / 2 - 160, { width: 300 });
    doc.restore();

    // Escudo + nombre de la institución: misma cabecera que el diploma.
    const escudo = fs.readFileSync(IMG('escudo.png'));
    doc.image(escudo, W / 2 - 41, 74, { width: 82, height: 82 * (607 / 581) });

    doc.fillColor(PALETA.navy).font('Times-Bold').fontSize(24)
        .text(INSTITUCION.nombre, MX, 172, { width: ANCHO, align: 'center' });

    // Encabezado institucional
    doc.font('Helvetica-Bold').fontSize(9).fillColor(PALETA.texto)
        .text(`EL DEPARTAMENTO DE GESTIÓN ACADÉMICA  ·  NIT ${INSTITUCION.nit}`, MX, 205, { width: ANCHO, align: 'center' });

    doc.font('Helvetica-Oblique').fontSize(7.5).fillColor('#6b7280')
        .text(MARCO_LEGAL, MX + 40, 220, { width: ANCHO - 80, align: 'center' });

    // "CERTIFICA QUE", con filetes dorados a los lados
    doc.font('Times-Bold').fontSize(20).fillColor(PALETA.navy)
        .text('CERTIFICA QUE', MX, 249, { width: ANCHO, align: 'center' });
    const anchoTitulo = doc.widthOfString('CERTIFICA QUE');
    doc.save().lineWidth(1.2).strokeColor(PALETA.dorado)
        .moveTo(W / 2 - anchoTitulo / 2 - 46, 261).lineTo(W / 2 - anchoTitulo / 2 - 14, 261).stroke()
        .moveTo(W / 2 + anchoTitulo / 2 + 14, 261).lineTo(W / 2 + anchoTitulo / 2 + 46, 261).stroke()
        .restore();

    // Estudiante
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827')
        .text(nombre, MX, 286, { width: ANCHO, align: 'center' });
    doc.font('Helvetica').fontSize(11).fillColor('#374151')
        .text(`${tipoDocumento}. No. ${numeroDocumento}`, MX, 307, { width: ANCHO, align: 'center' });

    // Cuerpo
    let y = 338;
    doc.font('Helvetica').fontSize(11).fillColor('#1f2937');
    const cuerpo = `${fraseConstancia(curso)}, con una intensidad académica de ${intensidadHoraria} horas, desarrollado entre el ${formatFechaDDMMYYYY(fechaInicio)} y el ${formatFechaDDMMYYYY(fechaFin)}.`;
    doc.text(cuerpo, MX, y, { width: ANCHO, align: 'justify' });
    y = doc.y + 8;

    doc.font('Helvetica').fontSize(9.5).fillColor(PALETA.textoSuave);
    doc.text(
        'El citado curso se desarrolló conforme a los lineamientos y normativas vigentes en materia de educación para el trabajo y el desarrollo humano, contribuyendo así al fortalecimiento de las competencias teórico-prácticas en esta área.',
        MX, y, { width: ANCHO, align: 'justify' }
    );
    y = doc.y + 16;

    // Registro
    const { dia, mes, anio } = partesFechaLarga(fechaExpedicion);
    doc.font('Helvetica').fontSize(9.5).fillColor(PALETA.textoSuave);
    doc.text(
        `La presente constancia queda debidamente registrada en el Folio No. ${folio}, con fecha ${formatFechaDDMMYYYY(fechaExpedicion)}, asentada en el Libro de Constancias No. ${libro} de nuestra institución.`,
        MX, y, { width: ANCHO, align: 'justify' }
    );
    y = doc.y + 6;
    doc.text(
        `Este certificado se expide en la ciudad de ${INSTITUCION.ciudad}, a los ${dia} días del mes de ${mes} del año ${anio}, a solicitud del estudiante y para los fines que estime pertinentes.`,
        MX, y, { width: ANCHO, align: 'justify' }
    );

    // Bloque de firma: se centra en el espacio que sobra entre el final del texto
    // y el pie de página, para que no quede un hueco enorme cuando el cuerpo es
    // corto ni se apelotone cuando es largo.
    const ALTO_FIRMA = 95;
    const H_FOOTER = 72;  // alto del marco inferior en vectores
    const finTexto = doc.y + 24;
    const finUtil = H - H_FOOTER - 24;
    const yFirma = Math.max(finTexto, finTexto + (finUtil - finTexto - ALTO_FIRMA) / 2);

    doc.image(fs.readFileSync(IMG('firma.png')), W / 2 - 76, yFirma, { width: 152, height: 56 });
    doc.save().lineWidth(0.8).strokeColor('#9ca3af')
        .moveTo(W / 2 - 100, yFirma + 60).lineTo(W / 2 + 100, yFirma + 60).stroke().restore();

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827')
        .text(INSTITUCION.representante.toUpperCase(), MX, yFirma + 66, { width: ANCHO, align: 'center' });
    doc.font('Helvetica').fontSize(9).fillColor('#4b5563')
        .text(`NIT ${INSTITUCION.nit}  ·  Representante Legal  ·  TP ${INSTITUCION.tarjetaProfesional}`, MX, yFirma + 81, { width: ANCHO, align: 'center' });

    // Sello a la izquierda y QR de verificación a la derecha
    doc.image(fs.readFileSync(IMG('sello.png')), MX, yFirma + 6, { width: 78, height: 78 });

    const qr = await QRCode.toDataURL(INSTITUCION.urlVerificacion, { errorCorrectionLevel: 'H', margin: 1, scale: 4 });
    doc.image(qr, W - MX - 74, yFirma + 6, { width: 74 });
    doc.font('Helvetica').fontSize(6.5).fillColor('#6b7280')
        .text('Verifica este documento', W - MX - 90, yFirma + 84, { width: 90, align: 'center' });

    // Datos de contacto sobre la banda navy inferior
    doc.font('Helvetica').fontSize(7.5).fillColor('#ffffff')
        .text(`${INSTITUCION.telefono}  ·  ${INSTITUCION.correo}  ·  ${INSTITUCION.ciudad}, Colombia`,
            MX, H - 20, { width: ANCHO, align: 'center' });

    dibujarPatronOndas(doc);
};

// ──────────────────────────────────────────────────────────────────────────
// Controladores
// ──────────────────────────────────────────────────────────────────────────

const CAMPOS_REQUERIDOS = ['nombre', 'numeroDocumento', 'tipoDocumento', 'curso'];

const validar = (body) => {
    const faltan = CAMPOS_REQUERIDOS.filter(c => !body[c]);
    return faltan.length ? `Faltan datos obligatorios: ${faltan.join(', ')}.` : null;
};

// Folio automático: identificador único e irrepetible de la acreditación.
// Se genera aquí (no lo escribe el usuario) para que no haya folios repetidos
// ni saltados. El diploma y el certificado de una misma acreditación comparten
// folio, por eso se genera UNA vez por petición y no por pieza.
const generarFolio = () => randomUUID().toUpperCase();

const datosDesde = (body, folio = generarFolio()) => ({
    nombre: body.nombre,
    numeroDocumento: body.numeroDocumento,
    tipoDocumento: body.tipoDocumento,
    curso: body.curso,
    intensidadHoraria: body.intensidadHoraria || '',
    fechaInicio: body.fechaInicio,
    fechaFin: body.fechaFin,
    fechaExpedicion: body.fechaExpedicion,
    libro: body.libro || INSTITUCION.libro,
    folio,
});

const generarDiplomaController = async (req, res) => {
    const error = validar(req.body);
    if (error) return res.status(400).json({ error });

    try {
        const { nombre, numeroDocumento } = req.body;
        const folio = generarFolio();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Diploma_${String(nombre).replace(/\s/g, '_')}_${numeroDocumento}.pdf"`);
        res.setHeader('X-Folio', folio);

        const doc = new PDFDocument({ size: [720, 540], margin: 0 });
        doc.pipe(res);
        await dibujarDiploma(doc, datosDesde(req.body, folio));
        doc.end();

        console.log(`Diploma PDF generado para: ${nombre}`);
    } catch (err) {
        console.error('Error al generar el diploma:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Error interno del servidor al generar el diploma.', details: err.message });
        }
    }
};

const generarConstanciaController = async (req, res) => {
    const error = validar(req.body);
    if (error) return res.status(400).json({ error });

    try {
        const { nombre, numeroDocumento } = req.body;
        const folio = generarFolio();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Certificado_${String(nombre).replace(/\s/g, '_')}_${numeroDocumento}.pdf"`);
        res.setHeader('X-Folio', folio);

        const doc = new PDFDocument({ size: 'A4', margin: 0 });
        doc.pipe(res);
        await dibujarConstancia(doc, datosDesde(req.body, folio));
        doc.end();

        console.log(`Constancia PDF generada para: ${nombre}`);
    } catch (err) {
        console.error('Error al generar la constancia:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Error interno del servidor al generar la constancia.', details: err.message });
        }
    }
};

// Acreditación completa en UN solo PDF: página 1 el diploma (carta apaisada),
// página 2 el certificado (A4 vertical).
//
// Va en un único archivo a propósito:
//   · las dos piezas son la misma acreditación y comparten folio;
//   · dos descargas automáticas seguidas hacen que el navegador bloquee la
//     segunda (Chrome corta las descargas programáticas múltiples), que es
//     justo por lo que antes solo llegaba el diploma.
const generarAcreditacionController = async (req, res) => {
    const error = validar(req.body);
    if (error) return res.status(400).json({ error });

    try {
        const { nombre, numeroDocumento } = req.body;
        const folio = generarFolio();
        const datos = datosDesde(req.body, folio);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Acreditacion_${String(nombre).replace(/\s/g, '_')}_${numeroDocumento}.pdf"`);
        // El front lo muestra al usuario para que quede registrado el folio asignado.
        res.setHeader('X-Folio', folio);

        const doc = new PDFDocument({ size: [720, 540], margin: 0 });
        doc.pipe(res);

        await dibujarDiploma(doc, datos);
        doc.addPage({ size: 'A4', margin: 0 });
        await dibujarConstancia(doc, datos);

        doc.end();

        console.log(`Acreditación (diploma + certificado) generada para: ${nombre} — folio ${folio}`);
    } catch (err) {
        console.error('Error al generar la acreditación:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Error interno del servidor al generar la acreditación.', details: err.message });
        }
    }
};

export {
    dibujarDiploma,
    dibujarConstancia,
    generarDiplomaController,
    generarConstanciaController,
    generarAcreditacionController,
};

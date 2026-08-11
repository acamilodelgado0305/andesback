// src/utils/pdfHelpers.js
// Helpers compartidos por los generadores de documentos en PDF
// (certificado/carnet de manipulación de alimentos, diploma y constancia).

// ──────────────────────────────────────────────────────────────────────────
// Seguridad visual
// ──────────────────────────────────────────────────────────────────────────

// Dibuja un patrón de ondas semitransparente sobre la página actual del documento.
// Actúa como marca de seguridad anti-copia: las ondas se reproducen distorsionadas
// en fotocopias o escaneos de baja calidad, haciendo evidente la copia.
export const dibujarPatronOndas = (doc, opciones = {}) => {
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

// ──────────────────────────────────────────────────────────────────────────
// Helpers de fecha
// ──────────────────────────────────────────────────────────────────────────

const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// Formatea una fecha (ISO, 'YYYY-MM-DD', Date, timestamp) a 'dd/mm/yyyy'.
// Si no se provee o es inválida, usa la fecha ACTUAL (comportamiento previo).
// Para strings ISO se toma la parte de fecha para evitar corrimientos por zona
// horaria (que un timestamp a medianoche UTC pinte el día anterior).
export const formatFechaDDMMYYYY = (value) => {
    if (value) {
        const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return `${m[3]}/${m[2]}/${m[1]}`;
        const d = new Date(value);
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' });
        }
    }
    return new Date().toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

// Suma un año a la fecha de expedición y la formatea. Se usa para el vencimiento
// del carnet cuando no viene una fecha de vencimiento explícita.
export const addOneYearFormatted = (value) => {
    const m = value && String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${Number(m[1]) + 1}`;
    let base = value ? new Date(value) : new Date();
    if (isNaN(base.getTime())) base = new Date();
    base.setFullYear(base.getFullYear() + 1);
    return base.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

// Descompone una fecha en { dia, mes, anio } con el mes en letras, para las
// fórmulas legales tipo "a los 08 días del mes de Enero del 2026".
export const partesFechaLarga = (value) => {
    let d;
    const m = value && String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
        d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    } else {
        d = value ? new Date(value) : new Date();
        if (isNaN(d.getTime())) d = new Date();
    }
    return {
        dia: String(d.getDate()).padStart(2, '0'),
        mes: MESES[d.getMonth()],
        anio: String(d.getFullYear()),
    };
};

// ──────────────────────────────────────────────────────────────────────────
// Ajuste de texto
// ──────────────────────────────────────────────────────────────────────────

// Ajusta un texto para que quepa en una sola línea de ancho `maxWidth`: primero
// baja el tamaño de fuente y, si aún se desborda, recorta con elipsis.
// Ojo: la opción `ellipsis` de pdfkit NO aplica con `lineBreak: false`, por eso
// el ajuste se mide a mano con widthOfString().
// Deja el doc con la fuente/tamaño que usó para medir; el caller los reaplica.
export const ajustarAUnaLinea = (doc, texto, maxWidth, sizeMax = 12, sizeMin = 8, font = 'Helvetica-Bold') => {
    doc.font(font);

    let size = sizeMax;
    while (size > sizeMin && doc.fontSize(size).widthOfString(texto) > maxWidth) {
        size -= 0.5;
    }

    doc.fontSize(size);
    if (doc.widthOfString(texto) > maxWidth) {
        while (texto.length > 1 && doc.widthOfString(`${texto}…`) > maxWidth) {
            texto = texto.slice(0, -1);
        }
        texto = `${texto.trimEnd()}…`;
    }

    return { texto, size };
};

// src/services/documentosEmitidos.js
//
// Registro de los documentos que emite Alianza Capacitarte (certificado/carnet de
// manipulación de alimentos y diploma + certificado de acreditación).
//
// Cada documento recibe un CÓDIGO DE VERIFICACIÓN corto (p. ej. 7K3M-9Q2X) que se
// imprime debajo del QR. El QR lleva a la página pública de verificación con ese
// código, y la página lo consulta en GET /api/verificar-documento/:codigo.
//
// Volver a generar el MISMO documento (misma plantilla, persona, curso y fecha de
// expedición) reutiliza el código y actualiza los datos: así las descargas
// repetidas desde la página de verificación no llenan la tabla de duplicados, y
// corregir un nombre mal escrito deja el registro con el nombre bueno.

import { randomInt } from 'crypto';
import pool from '../database.js';

export const URL_VERIFICACION = 'https://www.alianzacapacitarte.com/verificacion.html';

// Plantillas registradas. Certificado y carnet de alimentos son UNA misma
// acreditación y comparten código; el diploma y su certificado también.
export const PLANTILLA_ALIMENTOS = 'alimentos';
export const PLANTILLA_ACREDITACION = 'acreditacion';

const ETIQUETAS = {
    [PLANTILLA_ALIMENTOS]: 'Certificado y carnet de Manipulación de Alimentos',
    [PLANTILLA_ACREDITACION]: 'Diploma y certificado de acreditación',
};

// Sin 0/O, 1/I/L para que el código se pueda dictar y teclear sin confusiones.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const generarCodigo = () => {
    let s = '';
    for (let i = 0; i < 8; i++) s += ALFABETO[randomInt(ALFABETO.length)];
    return `${s.slice(0, 4)}-${s.slice(4)}`;
};

// Acepta el código como lo teclee la persona: minúsculas, sin guion, con espacios.
export const normalizarCodigo = (valor) => {
    const limpio = String(valor || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return limpio.length === 8 ? `${limpio.slice(0, 4)}-${limpio.slice(4)}` : null;
};

export const urlVerificacion = (codigo) =>
    codigo ? `${URL_VERIFICACION}?codigo=${encodeURIComponent(codigo)}` : URL_VERIFICACION;

// 'YYYY-MM-DD' de una fecha de entrada (ISO, Date, timestamp). Para strings ISO se
// toma la parte de fecha, igual que formatFechaDDMMYYYY, para que el registro y el
// PDF muestren el mismo día. Sin fecha válida → hoy en Colombia.
const aFechaISO = (valor, porDefecto = true) => {
    if (valor) {
        const m = String(valor).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return `${m[1]}-${m[2]}-${m[3]}`;
        const d = new Date(valor);
        if (!isNaN(d.getTime())) return d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    }
    return porDefecto ? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) : null;
};

const sumarUnAnio = (iso) => `${Number(iso.slice(0, 4)) + 1}${iso.slice(4)}`;

/**
 * Registra (o reutiliza) el documento y devuelve su código de verificación.
 * Si la base de datos falla devuelve null: el PDF se genera igual, con el QR
 * genérico, en vez de dejar al cliente sin su documento.
 */
export const registrarDocumento = async ({
    plantilla,
    nombre,
    tipoDocumento,
    numeroDocumento,
    curso,
    intensidadHoraria,
    fechaInicio,
    fechaFin,
    fechaExpedicion,
    fechaVencimiento,
}) => {
    const expedicion = aFechaISO(fechaExpedicion);
    const vencimiento = aFechaISO(fechaVencimiento, false)
        || (plantilla === PLANTILLA_ALIMENTOS ? sumarUnAnio(expedicion) : null);
    // Alimentos es una sola acreditación por fecha, venga o no el nombre del
    // curso (el carnet no lo recibe); la acreditación sí depende del curso.
    const cursoClave = plantilla === PLANTILLA_ALIMENTOS ? '' : String(curso || '').trim().toLowerCase();

    for (let intento = 0; intento < 5; intento++) {
        try {
            const { rows } = await pool.query(
                `INSERT INTO public.documentos_emitidos
                    (codigo, plantilla, nombre, tipo_documento, numero_documento, curso, curso_clave,
                     intensidad_horaria, fecha_inicio, fecha_fin, fecha_expedicion, fecha_vencimiento)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                 ON CONFLICT (plantilla, numero_documento, curso_clave, fecha_expedicion) DO UPDATE SET
                    nombre             = EXCLUDED.nombre,
                    tipo_documento     = EXCLUDED.tipo_documento,
                    curso              = COALESCE(EXCLUDED.curso, documentos_emitidos.curso),
                    intensidad_horaria = COALESCE(EXCLUDED.intensidad_horaria, documentos_emitidos.intensidad_horaria),
                    fecha_inicio       = COALESCE(EXCLUDED.fecha_inicio, documentos_emitidos.fecha_inicio),
                    fecha_fin          = COALESCE(EXCLUDED.fecha_fin, documentos_emitidos.fecha_fin),
                    fecha_vencimiento  = COALESCE(EXCLUDED.fecha_vencimiento, documentos_emitidos.fecha_vencimiento),
                    updated_at         = NOW()
                 RETURNING codigo`,
                [
                    generarCodigo(),
                    plantilla,
                    String(nombre || '').trim(),
                    tipoDocumento || null,
                    String(numeroDocumento || '').trim(),
                    curso ? String(curso).trim() : null,
                    cursoClave,
                    intensidadHoraria ? String(intensidadHoraria) : null,
                    aFechaISO(fechaInicio, false),
                    aFechaISO(fechaFin, false),
                    expedicion,
                    vencimiento,
                ]
            );
            return rows[0].codigo;
        } catch (err) {
            // Choque del código aleatorio con uno existente: se intenta con otro.
            if (err.code === '23505' && err.constraint === 'documentos_emitidos_pkey') continue;
            console.error('No se pudo registrar el documento emitido:', err);
            return null;
        }
    }
    console.error('No se pudo asignar un código de verificación único tras 5 intentos.');
    return null;
};

const aRespuesta = (r) => ({
    codigo: r.codigo,
    plantilla: r.plantilla,
    tipo: ETIQUETAS[r.plantilla] || 'Documento académico',
    nombre: r.nombre,
    tipoDocumento: r.tipo_documento,
    numeroDocumento: r.numero_documento,
    curso: r.curso || (r.plantilla === PLANTILLA_ALIMENTOS ? 'Manipulación Higiénica de Alimentos' : null),
    intensidadHoraria: r.intensidad_horaria,
    fechaInicio: r.fecha_inicio,
    fechaFin: r.fecha_fin,
    fechaExpedicion: r.fecha_expedicion,
    fechaVencimiento: r.fecha_vencimiento,
});

// Fechas como 'YYYY-MM-DD' (to_char) para que el front no las corra de día.
const SELECT_DOCUMENTO = `
    SELECT codigo, plantilla, nombre, tipo_documento, numero_documento, curso, intensidad_horaria,
           to_char(fecha_inicio, 'YYYY-MM-DD')      AS fecha_inicio,
           to_char(fecha_fin, 'YYYY-MM-DD')         AS fecha_fin,
           to_char(fecha_expedicion, 'YYYY-MM-DD')  AS fecha_expedicion,
           to_char(fecha_vencimiento, 'YYYY-MM-DD') AS fecha_vencimiento
      FROM public.documentos_emitidos`;

export const buscarPorCodigo = async (codigo) => {
    const { rows } = await pool.query(`${SELECT_DOCUMENTO} WHERE codigo = $1`, [codigo]);
    return rows[0] ? aRespuesta(rows[0]) : null;
};

export const buscarPorNumeroDocumento = async (numeroDocumento) => {
    const { rows } = await pool.query(
        `${SELECT_DOCUMENTO} WHERE numero_documento = $1 ORDER BY fecha_expedicion DESC, created_at DESC`,
        [String(numeroDocumento).trim()]
    );
    return rows.map(aRespuesta);
};

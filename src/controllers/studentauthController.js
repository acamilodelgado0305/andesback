// src/controllers/studentAuthController.js
import pool from '../database.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'DEV_STUDENT_JWT_SECRET';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

export const generateStudentToken = (student) => {
  const payload = {
    studentId: student.id,
    documento: student.documento, // viene de numero_documento AS documento
    business_id: student.business_id ?? null, // institución activa
    role: 'student',
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// ── Helpers multi-institución ────────────────────────────────────────────────
// Un mismo documento puede tener un registro de `students` por institución
// (business). Estos helpers permiten listar esas instituciones y armar el
// payload de una en concreto.

// Lista las instituciones (registros de students) que comparten un documento.
const fetchInstitucionesByDocumento = async (documento) => {
  const { rows } = await pool.query(
    `SELECT s.id AS "studentId", s.business_id,
            COALESCE(b.name, 'Institución') AS business_name,
            s.nombre, s.apellido
       FROM students s
       LEFT JOIN businesses b ON b.id = s.business_id
      WHERE TRIM(CAST(s.numero_documento AS TEXT)) = TRIM($1)
        AND (s.archived = FALSE OR s.archived IS NULL)
      ORDER BY business_name ASC`,
    [documento]
  );
  return rows;
};

// Payload completo de UNA institución (por studentId): datos + institución + programas.
const fetchStudentPayload = async (studentId) => {
  const { rows } = await pool.query(
    `SELECT s.id, s.nombre, s.apellido,
            CAST(s.numero_documento AS TEXT) AS documento,
            s.coordinador_id, s.activo, s.business_id,
            COALESCE(b.name, 'Institución') AS business_name,
            COALESCE(
              json_agg(json_build_object(
                'programa_id', p.id, 'nombre', p.nombre, 'tipo_programa', p.tipo_programa,
                'duracion_meses', p.duracion_meses, 'valor_matricula', p.valor_matricula,
                'valor_mensualidad', p.valor_mensualidad
              )) FILTER (WHERE p.id IS NOT NULL), '[]'::json
            ) AS programas_asociados
       FROM students s
       LEFT JOIN businesses b ON b.id = s.business_id
       LEFT JOIN estudiante_programas ep ON s.id = ep.estudiante_id
       LEFT JOIN programas p ON ep.programa_id = p.id
      WHERE s.id = $1
      GROUP BY s.id, s.nombre, s.apellido, s.numero_documento, s.coordinador_id, s.activo, s.business_id, b.name
      LIMIT 1;`,
    [studentId]
  );
  return rows[0] || null;
};

const buildStudentResponse = (s) => ({
  id: s.id,
  nombre: s.nombre,
  apellido: s.apellido,
  nombre_completo: `${s.nombre} ${s.apellido}`.trim(),
  documento: s.documento,
  coordinador_id: s.coordinador_id,
  activo: s.activo,
  business_id: s.business_id,
  business_name: s.business_name,
  programas_asociados: s.programas_asociados || [],
});

// Igual que buildStudentResponse pero adjunta la lista de instituciones del mismo
// documento (para el selector de campus del header).
const buildFullResponse = async (s) => {
  const instituciones = await fetchInstitucionesByDocumento(s.documento);
  return {
    ...buildStudentResponse(s),
    instituciones: instituciones.map((i) => ({
      studentId: i.studentId,
      business_id: i.business_id,
      business_name: i.business_name,
    })),
  };
};

export const studentLogin = async (req, res) => {
  try {
    const { documento, password } = req.body;

    console.log("🔹 Body recibido en /student-portal/login:", req.body);

    if (!documento || !password) {
      return res.status(400).json({
        ok: false,
        error: "Debe enviar el documento y la contraseña.",
      });
    }

    const docTrim = String(documento).trim();
    const passTrim = String(password).trim();

    // Regla actual: documento = contraseña
    if (docTrim !== passTrim) {
      return res.status(401).json({
        ok: false,
        error: "Documento o contraseña incorrectos.",
      });
    }

    // Todas las instituciones (registros) que comparten este documento.
    const instituciones = await fetchInstitucionesByDocumento(docTrim);

    if (instituciones.length === 0) {
      return res.status(401).json({
        ok: false,
        error: "No se encontró un estudiante con ese documento.",
      });
    }

    // Varias instituciones → devolvemos la lista para que el estudiante elija
    // a qué campus entrar (todavía sin token; se emite al seleccionar).
    if (instituciones.length > 1) {
      return res.json({
        ok: true,
        multi: true,
        documento: docTrim,
        instituciones: instituciones.map((i) => ({
          studentId: i.studentId,
          business_id: i.business_id,
          business_name: i.business_name,
          nombre: i.nombre,
          apellido: i.apellido,
        })),
      });
    }

    // Una sola institución → login directo.
    const s = await fetchStudentPayload(instituciones[0].studentId);
    const token = generateStudentToken({ id: s.id, documento: s.documento, business_id: s.business_id });

    return res.json({
      ok: true,
      multi: false,
      message: "Login de estudiante exitoso.",
      token,
      student: await buildFullResponse(s),
    });
  } catch (error) {
    console.error("💥 Error en studentLogin:", error);
    return res.status(500).json({
      ok: false,
      error: "Error interno en el login de estudiante.",
    });
  }
};

// ── Seleccionar institución tras el login (público) ───────────────────────────
// El estudiante ya probó documento==contraseña en el login; aquí elige a qué
// institución entrar. Validamos que el registro elegido sea del mismo documento.
export const studentSelectInstitution = async (req, res) => {
  try {
    const { documento, studentId } = req.body;
    if (!documento || !studentId) {
      return res.status(400).json({ ok: false, error: "Faltan datos (documento y studentId)." });
    }
    const s = await fetchStudentPayload(studentId);
    if (!s) return res.status(404).json({ ok: false, error: "Institución no encontrada." });
    if (String(s.documento).trim() !== String(documento).trim()) {
      return res.status(403).json({ ok: false, error: "El documento no corresponde a la institución seleccionada." });
    }
    const token = generateStudentToken({ id: s.id, documento: s.documento, business_id: s.business_id });
    return res.json({ ok: true, token, student: await buildFullResponse(s) });
  } catch (error) {
    console.error("💥 Error en studentSelectInstitution:", error);
    return res.status(500).json({ ok: false, error: "Error interno al seleccionar la institución." });
  }
};

// ── Cambiar de institución ya dentro del campus (autenticado) ──────────────────
// El documento sale del token actual; solo se puede cambiar a otra institución
// que pertenezca a ese mismo documento.
export const studentSwitchInstitution = async (req, res) => {
  try {
    const documento = req.student?.documento;
    const { studentId } = req.body;
    if (!documento) return res.status(401).json({ ok: false, error: "Sesión inválida." });
    if (!studentId) return res.status(400).json({ ok: false, error: "Falta la institución destino." });

    const s = await fetchStudentPayload(studentId);
    if (!s) return res.status(404).json({ ok: false, error: "Institución no encontrada." });
    if (String(s.documento).trim() !== String(documento).trim()) {
      return res.status(403).json({ ok: false, error: "No puedes cambiar a una institución que no es tuya." });
    }
    const token = generateStudentToken({ id: s.id, documento: s.documento, business_id: s.business_id });
    return res.json({ ok: true, token, student: await buildFullResponse(s) });
  } catch (error) {
    console.error("💥 Error en studentSwitchInstitution:", error);
    return res.status(500).json({ ok: false, error: "Error interno al cambiar de institución." });
  }
};




export const getStudentProfile = async (req, res) => {
  try {
    const studentId = req.student?.id;

    if (!studentId) {
      return res.status(401).json({
        ok: false,
        error: 'No se pudo identificar al estudiante.',
      });
    }

    const s = await fetchStudentPayload(studentId);
    if (!s) {
      return res.status(404).json({ ok: false, error: 'Estudiante no encontrado.' });
    }

    return res.json({
      ok: true,
      student: await buildFullResponse(s),
    });
  } catch (error) {
    console.error('Error en getStudentProfile:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error interno al obtener el perfil del estudiante.',
    });
  }
};


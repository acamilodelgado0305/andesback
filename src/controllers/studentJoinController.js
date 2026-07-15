// src/controllers/studentJoinController.js
// Auto-registro + inscripción de un estudiante a través del enlace de un programa
// (estilo "unirse" de Classroom). Público, sin auth — el token del enlace es el
// único requisito.
import pool from '../database.js';
import { insertStudentToDB } from './studentController.js';
import { generateStudentToken } from './studentauthController.js';

const fetchStudentWithProgramas = async (studentId) => {
  const { rows } = await pool.query(
    `SELECT
       s.id, s.nombre, s.apellido,
       CAST(s.numero_documento AS TEXT) AS documento,
       s.coordinador_id, s.activo,
       COALESCE(
         json_agg(
           json_build_object(
             'programa_id', p.id,
             'nombre', p.nombre,
             'tipo_programa', p.tipo_programa,
             'duracion_meses', p.duracion_meses,
             'valor_matricula', p.valor_matricula,
             'valor_mensualidad', p.valor_mensualidad
           )
         ) FILTER (WHERE p.id IS NOT NULL),
         '[]'::json
       ) AS programas_asociados
     FROM students s
     LEFT JOIN estudiante_programas ep ON s.id = ep.estudiante_id
     LEFT JOIN programas p ON ep.programa_id = p.id
     WHERE s.id = $1
     GROUP BY s.id, s.nombre, s.apellido, s.numero_documento, s.coordinador_id, s.activo
     LIMIT 1;`,
    [studentId]
  );
  return rows[0] || null;
};

const buildStudentResponse = (student) => ({
  id: student.id,
  nombre: student.nombre,
  apellido: student.apellido,
  nombre_completo: `${student.nombre} ${student.apellido}`.trim(),
  documento: student.documento,
  coordinador_id: student.coordinador_id,
  activo: student.activo,
  programas_asociados: student.programas_asociados || [],
});

export const joinPrograma = async (req, res) => {
  const { token } = req.params;
  const { numero_documento, nombre, apellido, email, tipoDocumento, telefono_whatsapp } = req.body;
  const whatsapp = telefono_whatsapp ? String(telefono_whatsapp).trim() : null;

  if (!numero_documento || !String(numero_documento).trim()) {
    return res.status(400).json({ ok: false, error: 'El número de documento es requerido.' });
  }
  const documento = String(numero_documento).trim();

  try {
    // 1) Enlaces por coordinador (tabla nueva): el coordinador sale del enlace.
    const { rows: linkRows } = await pool.query(
      `SELECT p.id, p.nombre, p.business_id, l.coordinador_id
       FROM programa_join_links l
       JOIN programas p ON p.id = l.programa_id
       WHERE l.token = $1 AND l.enabled = true AND p.activo = true;`,
      [token]
    );

    let programa = linkRows[0];

    // 2) Compatibilidad: enlace único legacy en la tabla programas.
    if (!programa) {
      const { rows: progRows } = await pool.query(
        `SELECT id, nombre, business_id, join_coordinador_id AS coordinador_id
         FROM programas
         WHERE join_token = $1 AND join_enabled = true AND activo = true;`,
        [token]
      );
      programa = progRows[0];
    }

    if (!programa) {
      return res.status(404).json({ ok: false, error: 'Enlace de inscripción inválido o inactivo.' });
    }

    const { rows: existingRows } = await pool.query(
      `SELECT id FROM students WHERE numero_documento = $1 AND business_id = $2 LIMIT 1;`,
      [documento, programa.business_id]
    );

    let studentId;
    let isNew = false;

    if (existingRows.length) {
      studentId = existingRows[0].id;
      await pool.query(
        `INSERT INTO estudiante_programas (estudiante_id, programa_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING;`,
        [studentId, programa.id]
      );
      // Si el estudiante ya existe pero no tiene WhatsApp registrado, lo completamos
      // con el que acaba de ingresar (no sobreescribimos un número ya existente).
      if (whatsapp) {
        await pool.query(
          `UPDATE students
              SET telefono_whatsapp = $1, updated_at = NOW()
            WHERE id = $2
              AND (telefono_whatsapp IS NULL OR telefono_whatsapp = '');`,
          [whatsapp, studentId]
        );
      }
    } else {
      if (!nombre || !apellido || !email) {
        return res.status(400).json({
          ok: false,
          error: 'No existe un estudiante con ese documento. Nombre, apellido y email son obligatorios para registrarte.',
        });
      }

      try {
        const result = await insertStudentToDB(
          {
            nombre, apellido, email, tipoDocumento, numeroDocumento: documento,
            telefonoWhatsapp: whatsapp,
            coordinador_id: programa.coordinador_id,
            business_id: programa.business_id,
            programasIds: [programa.id],
          },
          res,
          { silent: true }
        );
        studentId = result.studentId;
        isNew = true;
      } catch (err) {
        if (err.code === '23505') {
          return res.status(409).json({ ok: false, error: 'Ya existe un estudiante con ese documento o correo electrónico.' });
        }
        throw err;
      }
    }

    const student = await fetchStudentWithProgramas(studentId);
    const token_jwt = generateStudentToken(student);

    return res.json({
      ok: true,
      message: isNew ? 'Registro e inscripción exitosos.' : 'Inscripción exitosa.',
      token: token_jwt,
      isNew,
      student: buildStudentResponse(student),
    });
  } catch (error) {
    console.error('Error en joinPrograma:', error);
    return res.status(500).json({ ok: false, error: 'Error interno al procesar la inscripción.' });
  }
};

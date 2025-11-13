// src/controllers/studentAuthController.js
import pool from '../database.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'DEV_STUDENT_JWT_SECRET';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

const generateStudentToken = (student) => {
  const payload = {
    studentId: student.id,
    documento: student.documento, // viene de numero_documento AS documento
    role: 'student',
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const studentLogin = async (req, res) => {
  try {
    const { documento, password } = req.body;

    console.log('🔹 Body recibido en /student-portal/login:', req.body);

    if (!documento || !password) {
      return res.status(400).json({
        ok: false,
        error: 'Debe enviar el documento y la contraseña.',
      });
    }

    const docTrim = String(documento).trim();
    const passTrim = String(password).trim();

    // Regla actual: documento = contraseña
    if (docTrim !== passTrim) {
      console.log('❌ Documento y contraseña no coinciden:', docTrim, passTrim);
      return res.status(401).json({
        ok: false,
        error: 'Documento o contraseña incorrectos.',
      });
    }

    console.log('🔍 Buscando estudiante con numero_documento:', docTrim);

    const query = `
      SELECT 
        id,
        nombre,
        apellido,
        -- alias: numero_documento -> documento para seguir usando "documento" en el resto del código
        CAST(numero_documento AS TEXT) AS documento,
        programa_id,
        coordinador_id,
        activo
      FROM students
      WHERE TRIM(CAST(numero_documento AS TEXT)) = TRIM($1)
      LIMIT 1;
    `;

    const { rows } = await pool.query(query, [docTrim]);

    console.log('🔎 Resultados de búsqueda:', rows);

    if (rows.length === 0) {
      return res.status(401).json({
        ok: false,
        error: 'No se encontró un estudiante con ese documento.',
      });
    }

    const student = rows[0];

  
    const token = generateStudentToken(student);

    return res.json({
      ok: true,
      message: 'Login de estudiante exitoso.',
      token,
      student: {
        id: student.id,
        nombre: student.nombre,
        apellido: student.apellido,
        nombre_completo: `${student.nombre} ${student.apellido}`.trim(),
        documento: student.documento,           // ← ahora es numero_documento
        programa_id: student.programa_id,
        coordinador_id: student.coordinador_id,
      },
    });
  } catch (error) {
    console.error('💥 Error en studentLogin:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error interno en el login de estudiante.',
    });
  }
};


export const getStudentProfile = async (req, res) => {
  try {
    const studentId = req.student?.id; // seteado por el middleware

    if (!studentId) {
      return res.status(401).json({
        ok: false,
        error: 'No se pudo identificar al estudiante.',
      });
    }

    const query = `
      SELECT 
        id,
        nombre,
        apellido,
        documento,
        programa_id,
        coordinador_id,
        activo
      FROM students
      WHERE id = $1
      LIMIT 1;
    `;

    const { rows } = await pool.query(query, [studentId]);

    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'Estudiante no encontrado.',
      });
    }

    const student = rows[0];

    return res.json({
      ok: true,
      student: {
        id: student.id,
        nombre: student.nombre,
        apellido: student.apellido,
        nombre_completo: `${student.nombre} ${student.apellido}`.trim(),
        documento: student.documento,
        programa_id: student.programa_id,
        coordinador_id: student.coordinador_id,
        activo: student.activo,
      },
    });
  } catch (error) {
    console.error('Error en getStudentProfile:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error interno al obtener el perfil del estudiante.',
    });
  }
};

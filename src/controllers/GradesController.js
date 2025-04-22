import pool from '../database.js';

const getGradesController = async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT student_id, materia, nota 
         FROM grades`
      );
      res.status(200).json(result.rows);
    } catch (err) {
      console.error('Error obteniendo notas', err);
      res.status(500).json({ error: 'Error obteniendo notas' });
    }
};

const saveGradesController = async (req, res) => {
    const gradesData = req.body; // Array de { studentId, grades: { [materia]: nota } }
    try {
        await pool.query('BEGIN'); // Iniciar transacción

        for (const { studentId, grades } of gradesData) {
            for (const [materia, nota] of Object.entries(grades)) {
                if (nota !== null && nota !== undefined) {
                    await pool.query(
                        `INSERT INTO grades (student_id, materia, nota, created_at, updated_at)
                         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                         ON CONFLICT (student_id, materia)
                         DO UPDATE SET nota = $3, updated_at = CURRENT_TIMESTAMP`,
                        [studentId, materia, nota]
                    );
                }
            }
        }

        await pool.query('COMMIT'); // Confirmar transacción
        res.status(201).json({ message: 'Notas guardadas exitosamente' });
    } catch (err) {
        await pool.query('ROLLBACK'); // Revertir transacción en caso de error
        console.error('Error guardando notas', err);
        res.status(500).json({ error: 'Error guardando notas' });
    }
};

const getGradesByStudentIdController = async (req, res) => {
    const { id } = req.params; // Obtener el student_id de los parámetros de la URL

    // Validar que id sea un número válido
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'ID de estudiante inválido' });
    }

    try {
      const result = await pool.query(
        `SELECT student_id, materia, nota 
         FROM grades 
         WHERE student_id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No se encontraron notas para este estudiante' });
      }

      res.status(200).json(result.rows);
    } catch (err) {
      console.error('Error obteniendo notas del estudiante', err);
      res.status(500).json({ error: 'Error obteniendo notas del estudiante' });
    }
};

export {
    getGradesController,
    saveGradesController,
    getGradesByStudentIdController
};
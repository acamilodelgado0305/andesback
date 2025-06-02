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




const getGradesByStudentDocumentController = async (req, res) => {
    const { numero_documento } = req.params;

    // Validar que el número de documento sea proporcionado
    if (!numero_documento || String(numero_documento).trim() === '') {
        return res.status(400).json({ error: 'El número de documento es requerido.' });
    }

    try {
        // 1. Buscar la información del estudiante y su ID.
        // Ajusta los nombres de las columnas 'programa_nombre' y 'coordinador'
        // si son diferentes en tu tabla 'students' o si necesitas JOINs.
        const studentQuery = `
            SELECT 
                s.id,           -- Este será el studentId para el PDF
                s.nombre, 
                s.apellido, 
                s.programa_nombre, 
                s.coordinador
            FROM students s
            WHERE s.numero_documento = $1
        `;
        // Si 'programa_nombre' o 'coordinador' vienen de otras tablas, un ejemplo con JOIN:
        /*
        const studentQuery = `
            SELECT 
                s.id,
                s.nombre,
                s.apellido,
                p.nombre_programa AS programa_nombre, -- Suponiendo una tabla 'programas'
                c.nombre_coordinador AS coordinador    -- Suponiendo una tabla 'coordinadores'
            FROM students s
            LEFT JOIN programas p ON s.id_programa = p.id
            LEFT JOIN coordinadores c ON s.id_coordinador = c.id
            WHERE s.numero_documento = $1
        `;
        */
        const studentResult = await pool.query(studentQuery, [numero_documento]);

        if (studentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Estudiante no encontrado con el número de documento proporcionado.' });
        }

        const studentDataFromDB = studentResult.rows[0];

        // Estructurar la información del estudiante como la espera el componente PDF
        const studentInfoForPDF = {
            nombre: studentDataFromDB.nombre,
            apellido: studentDataFromDB.apellido,
            programa_nombre: studentDataFromDB.programa_nombre || 'No asignado', // Valor por defecto
            coordinador: studentDataFromDB.coordinador || 'No asignado'         // Valor por defecto
        };
        const studentIdForPDF = studentDataFromDB.id;

        // 2. Obtener las notas del estudiante usando su ID
        // La estructura de 'grades' (materia, nota) es la que espera el componente PDF.
        const gradesQuery = `
            SELECT materia, nota 
            FROM grades 
            WHERE student_id = $1
            ORDER BY materia ASC  -- Opcional: para que las materias salgan ordenadas
        `;
        const gradesResult = await pool.query(gradesQuery, [studentIdForPDF]);
        const gradesForPDF = gradesResult.rows;

        // 3. Devolver los datos en formato JSON
        // La estructura de este JSON debe coincidir con los parámetros
        // que espera tu función generateGradeReportPDF(student, grades, studentId)
        res.status(200).json({
            student: studentInfoForPDF, // Objeto para el parámetro 'student'
            grades: gradesForPDF,       // Array para el parámetro 'grades'
            studentId: studentIdForPDF  // Valor para el parámetro 'studentId'
        });

    } catch (err) {
        console.error('Error obteniendo datos para el reporte del estudiante:', err);
        res.status(500).json({ error: 'Error interno del servidor al obtener los datos del reporte.' });
    }
};



export {
    getGradesController,
    saveGradesController,
    getGradesByStudentIdController,
    getGradesByStudentDocumentController
};
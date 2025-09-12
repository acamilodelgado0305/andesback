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
    // El frontend ahora enviará un array de { studentId, programa: "...", grades: { ... } }
    const gradesData = req.body; 
    
    try {
        await pool.query('BEGIN');

        // -- CAMBIO: Extraemos 'programa' del objeto
        for (const { studentId, programa, grades } of gradesData) {
            
            if (!programa) {
                throw new Error(`Falta el tipo de programa para el estudiante con ID: ${studentId}.`);
            }

            for (const [materia, nota] of Object.entries(grades)) {
                if (nota !== null && nota !== undefined) {
                    await pool.query(
                        // -- CAMBIO: Añadimos 'programa' a la consulta INSERT
                        `INSERT INTO grades (student_id, programa, materia, nota, created_at, updated_at)
                         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                         -- CAMBIO: El ON CONFLICT ahora usa la nueva llave primaria
                         ON CONFLICT (student_id, programa, materia)
                         DO UPDATE SET nota = $4, updated_at = CURRENT_TIMESTAMP`,
                        // -- CAMBIO: Pasamos 'programa' como segundo parámetro
                        [studentId, programa, materia, nota]
                    );
                }
            }
        }

        await pool.query('COMMIT');
        res.status(201).json({ message: 'Notas guardadas exitosamente' });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('Error guardando notas', err);
        res.status(500).json({ error: err.message || 'Error guardando notas' });
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

    // --- Depuración: Verificar el valor que llega al controlador ---
    console.log('--- Depuración: getGradesByStudentDocumentController ---');
    console.log('Número de documento recibido (req.params.numero_documento):', numero_documento);
    console.log('Tipo de dato del número de documento:', typeof numero_documento);
    console.log('----------------------------------------------------');

    if (!numero_documento || String(numero_documento).trim() === '') {
        return res.status(400).json({ error: 'El número de documento es requerido.' });
    }

    try {
        const studentQuery = `
            SELECT
                s.id,
                s.nombre,
                s.apellido,
                s.numero_documento,   -- **** ¡CAMBIO CRÍTICO AQUÍ! Si la columna es 'numero_documento' ****
                p.nombre AS programa_nombre,
                u.name AS coordinador
            FROM
                students s
            LEFT JOIN
                inventario p ON s.programa_id = p.id
            LEFT JOIN
                users u ON s.coordinador_id = u.id
            WHERE
                s.numero_documento = $1; -- **** ¡CAMBIO CRÍTICO AQUÍ! Si la columna es 'numero_documento' ****
        `;

        // --- Depuración: Ejecutar la consulta y ver el resultado exacto ---
        console.log('Consulta SQL para el estudiante:', studentQuery.replace('$1', `'${numero_documento}'`));
        const studentResult = await pool.query(studentQuery, [numero_documento]);
        console.log('Resultados de la consulta del estudiante (studentResult.rows):', studentResult.rows);
        console.log('Filas encontradas para el estudiante:', studentResult.rows.length);
        console.log('----------------------------------------------------');

        if (studentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Estudiante no encontrado con el número de documento proporcionado.' });
        }

        const studentDataFromDB = studentResult.rows[0];

        const studentInfoForPDF = {
            nombre: studentDataFromDB.nombre,
            apellido: studentDataFromDB.apellido,
            programa_nombre: studentDataFromDB.programa_nombre || 'No asignado',
            coordinador: studentDataFromDB.coordinador || 'No asignado',
            documento: studentDataFromDB.numero_documento // Asegúrate de usar la columna correcta aquí también para el objeto de respuesta
        };
        const studentIdForPDF = studentDataFromDB.id;

        const gradesQuery = `
            SELECT materia, nota
            FROM grades
            WHERE student_id = $1
            ORDER BY materia ASC;
        `;
        const gradesResult = await pool.query(gradesQuery, [studentIdForPDF]);
        const gradesForPDF = gradesResult.rows;

        res.status(200).json({
            student: studentInfoForPDF,
            grades: gradesForPDF,
            studentId: studentIdForPDF
        });

    } catch (err) {
        console.error(`Error obteniendo datos para el reporte del estudiante con documento ${numero_documento}:`, err);
        res.status(500).json({ error: 'Error interno del servidor al obtener los datos del reporte.' });
    }
};




export {
    getGradesController,
    saveGradesController,
    getGradesByStudentIdController,
    getGradesByStudentDocumentController
};
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
    const { id } = req.params;

    if (!id || isNaN(id)) {
        return res.status(400).json({ error: 'ID de estudiante inválido' });
    }

    try {
        // MODIFICADO: Se une la tabla `grades` con `materias` para filtrar solo las activas.
        const query = `
            SELECT 
                g.student_id, 
                g.materia, 
                g.nota 
            FROM 
                grades g
            JOIN 
                materias m ON g.materia = m.nombre
            WHERE 
                g.student_id = $1 AND m.activa = true
        `;

        const result = await pool.query(query, [id]);

        // La lógica de respuesta si no se encuentran notas sigue siendo válida.
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No se encontraron notas de materias activas para este estudiante' });
        }

        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error obteniendo notas del estudiante', err);
        res.status(500).json({ error: 'Error obteniendo notas del estudiante' });
    }
};



const getGradesByStudentDocumentController = async (req, res) => {
    const { numero_documento } = req.params;

    if (!numero_documento || String(numero_documento).trim() === '') {
        return res.status(400).json({ error: 'El número de documento es requerido.' });
    }

    try {
        // ... (la primera parte que busca al estudiante no cambia)
        const studentQuery = `
           SELECT
    s.id,
    s.nombre,
    s.apellido,
    s.numero_documento,
    p.nombre AS programa_nombre, -- Nombre del programa desde la tabla 'inventario'
    u.name AS coordinador       -- Asumo que quieres el nombre del coordinador desde una tabla 'users'
FROM
    students s
-- 1. Unimos students con la tabla intermedia 'estudiante_programas' usando el ID del estudiante.
LEFT JOIN
    estudiante_programas ep ON s.id = ep.estudiante_id
-- 2. Unimos la tabla intermedia con 'inventario' (tus programas) usando el ID del programa.
LEFT JOIN
    inventario p ON ep.programa_id = p.id
-- 3. Unimos students con 'users' para obtener el nombre del coordinador (opcional, pero estaba en tu código original).
LEFT JOIN
    users u ON s.coordinador_id = u.id
WHERE
    s.numero_documento = $1;
        `;
        const studentResult = await pool.query(studentQuery, [numero_documento]);

        if (studentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Estudiante no encontrado con el número de documento proporcionado.' });
        }

        const studentDataFromDB = studentResult.rows[0];
        const studentIdForPDF = studentDataFromDB.id;
        const studentInfoForPDF = {
            nombre: studentDataFromDB.nombre,
            apellido: studentDataFromDB.apellido,
            programa_nombre: studentDataFromDB.programa_nombre || 'No asignado',
            coordinador: studentDataFromDB.coordinador || 'No asignado',
            documento: studentDataFromDB.numero_documento
        };

        // MODIFICADO: Se añade el JOIN con la tabla `materias` para filtrar solo las activas.
        const gradesQuery = `
            SELECT 
                g.materia, 
                g.nota
            FROM 
                grades g
            JOIN 
                materias m ON g.materia = m.nombre
            WHERE 
                g.student_id = $1 AND m.activa = true
            ORDER BY 
                g.materia ASC;
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
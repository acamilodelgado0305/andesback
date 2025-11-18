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

  if (!numero_documento || String(numero_documento).trim() === "") {
    return res
      .status(400)
      .json({ error: "El número de documento es requerido." });
  }

  try {
    const docTrim = String(numero_documento).trim();

    // ✅ CONSULTA 1 AJUSTADA:
    // - Ya NO usa inventario ni s.programa_id
    // - Programa(s) salen de estudiante_programas + programas
    const studentQuery = `
      SELECT 
        s.id, 
        s.nombre, 
        s.apellido, 
        s.numero_documento, 
        u.name AS coordinador,
        -- Si tiene varios programas, concatenamos sus nombres en una sola cadena
        COALESCE(
          (
            SELECT string_agg(p.nombre, ', ' ORDER BY p.nombre)
            FROM estudiante_programas ep
            JOIN programas p ON ep.programa_id = p.id
            WHERE ep.estudiante_id = s.id
          ),
          'No asignado'
        ) AS programa_nombre
      FROM 
        students s 
      LEFT JOIN 
        users u ON s.coordinador_id = u.id
      WHERE 
        TRIM(CAST(s.numero_documento AS TEXT)) = TRIM($1)
      LIMIT 1;
    `;

    const studentResult = await pool.query(studentQuery, [docTrim]);

    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        error: "Estudiante no encontrado con el número de documento proporcionado.",
      });
    }

    const studentDataFromDB = studentResult.rows[0];
    const studentIdForPDF = studentDataFromDB.id;

    // Mantienes el mismo shape que ya usabas
    const studentInfoForPDF = {
      nombre: studentDataFromDB.nombre,
      apellido: studentDataFromDB.apellido,
      programa_nombre: studentDataFromDB.programa_nombre || "No asignado",
      coordinador: studentDataFromDB.coordinador || "No asignado",
      documento: studentDataFromDB.numero_documento,
    };

    // ✅ CONSULTA 2: tu lógica de grades se mantiene igual
    const gradesQuery = `
      SELECT  
        g.materia,  
        g.nota 
      FROM  
        grades g 
      JOIN  
        materias m ON LOWER(TRIM(g.materia)) = LOWER(TRIM(m.nombre))
      WHERE  
        g.student_id = $1 AND m.activa = true 
      ORDER BY  
        g.materia ASC;
    `;
    const gradesResult = await pool.query(gradesQuery, [studentIdForPDF]);
    const gradesForPDF = gradesResult.rows;

    return res.status(200).json({
      student: studentInfoForPDF,
      grades: gradesForPDF,
      studentId: studentIdForPDF,
    });
  } catch (err) {
    console.error(
      `Error obteniendo datos para el reporte del estudiante con documento ${numero_documento}:`,
      err
    );
    return res.status(500).json({
      error: "Error interno del servidor al obtener los datos del reporte.",
    });
  }
};





export {
    getGradesController,
    saveGradesController,
    getGradesByStudentIdController,
    getGradesByStudentDocumentController
};
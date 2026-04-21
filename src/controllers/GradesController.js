import pool from '../database.js';

const getGradesController = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT student_id, materia, nota, cierre_id FROM grades`
        );
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error obteniendo notas', err);
        res.status(500).json({ error: 'Error obteniendo notas' });
    }
};

// Payload: [{ studentId, programa, cierre_id, grades: { materia: nota } }]
const saveGradesController = async (req, res) => {
    const gradesData = req.body;

    // Aplanar a arrays para bulk upsert con UNNEST
    const studentIds = [], programas = [], materias = [], notas = [], cierreIds = [];

    for (const { studentId, programa, cierre_id, grades } of gradesData) {
        if (!programa) return res.status(400).json({ error: `Falta el programa para estudiante ID: ${studentId}.` });
        if (!cierre_id) return res.status(400).json({ error: `Falta el cierre_id para estudiante ID: ${studentId}.` });
        for (const [materia, nota] of Object.entries(grades)) {
            if (nota !== null && nota !== undefined) {
                studentIds.push(studentId);
                programas.push(programa);
                materias.push(materia);
                notas.push(nota);
                cierreIds.push(cierre_id);
            }
        }
    }

    if (studentIds.length === 0) {
        return res.status(200).json({ message: 'Sin cambios que guardar' });
    }

    try {
        await pool.query(
            `INSERT INTO grades (student_id, programa, materia, nota, cierre_id, created_at, updated_at)
             SELECT UNNEST($1::int[]), UNNEST($2::text[]), UNNEST($3::text[]),
                    UNNEST($4::numeric[]), UNNEST($5::int[]), NOW(), NOW()
             ON CONFLICT (student_id, materia, cierre_id)
             DO UPDATE SET nota = EXCLUDED.nota, updated_at = NOW()`,
            [studentIds, programas, materias, notas, cierreIds]
        );
        res.status(201).json({ message: 'Notas guardadas exitosamente' });
    } catch (err) {
        console.error('Error guardando notas', err);
        res.status(500).json({ error: err.message || 'Error guardando notas' });
    }
};

// Portal admin: notas de un estudiante por ID (agrupadas por cierre)
const getGradesByStudentIdController = async (req, res) => {
    const { id } = req.params;

    if (!id || isNaN(id)) {
        return res.status(400).json({ error: 'ID de estudiante inválido' });
    }

    try {
        const query = `
            SELECT
                g.student_id,
                g.materia,
                g.nota,
                c.id       AS cierre_id,
                c.nombre   AS cierre_nombre,
                c.cerrado,
                c.fecha_cierre
            FROM grades g
            JOIN cierres c ON g.cierre_id = c.id
            JOIN materias m ON LOWER(TRIM(g.materia)) = LOWER(TRIM(m.nombre))
            JOIN estudiante_programas ep ON m.programa_id = ep.programa_id
            WHERE g.student_id = $1
              AND ep.estudiante_id = $1
              AND m.activa = true
            ORDER BY c.created_at ASC, g.materia ASC
        `;

        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No se encontraron notas para este estudiante' });
        }

        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error obteniendo notas del estudiante', err);
        res.status(500).json({ error: 'Error obteniendo notas del estudiante' });
    }
};

// Portal estudiante: notas por documento, filtradas por materias del programa,
// solo cierres cerrados, agrupadas por cierre
const getGradesByStudentDocumentController = async (req, res) => {
    const { numero_documento } = req.params;

    if (!numero_documento || String(numero_documento).trim() === '') {
        return res.status(400).json({ error: 'El número de documento es requerido.' });
    }

    try {
        const docTrim = String(numero_documento).trim();

        const studentQuery = `
            SELECT
                s.id,
                s.nombre,
                s.apellido,
                s.numero_documento,
                COALESCE(
                    (
                        SELECT string_agg(p.nombre, ', ' ORDER BY p.nombre)
                        FROM estudiante_programas ep
                        JOIN programas p ON ep.programa_id = p.id
                        WHERE ep.estudiante_id = s.id
                    ),
                    'No asignado'
                ) AS programa_nombre
            FROM students s
            WHERE TRIM(CAST(s.numero_documento AS TEXT)) = TRIM($1)
            LIMIT 1;
        `;

        const studentResult = await pool.query(studentQuery, [docTrim]);

        if (studentResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Estudiante no encontrado con el número de documento proporcionado.',
            });
        }

        const studentDataFromDB = studentResult.rows[0];
        const studentId = studentDataFromDB.id;

        const studentInfo = {
            nombre: studentDataFromDB.nombre,
            apellido: studentDataFromDB.apellido,
            programa_nombre: studentDataFromDB.programa_nombre || 'No asignado',
            documento: studentDataFromDB.numero_documento,
        };

        // Notas filtradas por materias del programa del estudiante,
        // solo cierres cerrados, ordenadas de más antiguo a más reciente
        const gradesQuery = `
            SELECT
                g.materia,
                g.nota,
                c.id            AS cierre_id,
                COALESCE(c.nombre, 'En curso')  AS cierre_nombre,
                c.fecha_cierre,
                COALESCE(c.created_at, NOW())   AS cierre_created_at
            FROM grades g
            LEFT JOIN cierres c     ON g.cierre_id = c.id
            JOIN materias m         ON LOWER(TRIM(g.materia)) = LOWER(TRIM(m.nombre))
            JOIN estudiante_programas ep ON m.programa_id = ep.programa_id
            WHERE g.student_id = $1
              AND ep.estudiante_id = $1
              AND m.activa = true
            ORDER BY cierre_created_at ASC, g.materia ASC
        `;

        const gradesResult = await pool.query(gradesQuery, [studentId]);

        // Agrupar por cierre
        const cierresMap = new Map();
        for (const row of gradesResult.rows) {
            if (!cierresMap.has(row.cierre_id)) {
                cierresMap.set(row.cierre_id, {
                    cierre_id: row.cierre_id,
                    nombre: row.cierre_nombre,
                    fecha_cierre: row.fecha_cierre,
                    grades: [],
                });
            }
            cierresMap.get(row.cierre_id).grades.push({
                materia: row.materia,
                nota: row.nota,
            });
        }

        const gradesByCierre = Array.from(cierresMap.values());
        // Lista plana para el PDF (todas las notas)
        const grades = gradesResult.rows.map((r) => ({ materia: r.materia, nota: r.nota }));

        return res.status(200).json({
            student: studentInfo,
            grades,
            gradesByCierre,
            studentId,
        });
    } catch (err) {
        console.error('Error obteniendo datos del estudiante:', err);
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

// Notas de un programa (admin), filtrables por cierre_id
const getGradesByProgramaController = async (req, res) => {
    const { programaId } = req.params;
    const { cierre_id } = req.query;
    const businessId = req.user?.bid;
    const userId     = req.user?.id;
    const userRole   = req.user?.role;

    if (!businessId) return res.status(403).json({ error: 'No se pudo determinar el negocio.' });

    const isAdmin = userRole === 'admin' || userRole === 'superadmin';

    try {
        const { rows: programaRows } = await pool.query(
            `SELECT * FROM programas WHERE id = $1 AND business_id = $2`,
            [programaId, businessId]
        );
        if (programaRows.length === 0) {
            return res.status(404).json({ error: 'Programa no encontrado.' });
        }
        const programa = programaRows[0];

        const studentsParams = [programaId, businessId];
        let coordinadorFilter = '';
        if (!isAdmin) {
            coordinadorFilter = `AND s.coordinador_id = $3`;
            studentsParams.push(userId);
        }

        const { rows: students } = await pool.query(`
            SELECT DISTINCT s.id, s.nombre, s.apellido, s.numero_documento
            FROM students s
            JOIN estudiante_programas ep ON ep.estudiante_id = s.id
            WHERE ep.programa_id = $1 AND s.business_id = $2 ${coordinadorFilter}
            ORDER BY s.apellido, s.nombre
        `, studentsParams);

        const studentIds = students.map((s) => s.id);
        let grades = [];
        if (studentIds.length > 0) {
            const gradesParams = [studentIds, programa.nombre];
            let cierreFilter = '';
            if (cierre_id) {
                // Incluir notas del cierre específico Y notas sin cierre asignado (guardadas antes de crear el cierre)
                // Si existe una nota con el cierre específico, tiene prioridad sobre la de cierre_id NULL
                cierreFilter = `AND (g.cierre_id = $3 OR g.cierre_id IS NULL)`;
                gradesParams.push(parseInt(cierre_id));
            }
            const { rows } = await pool.query(
                `SELECT DISTINCT ON (g.student_id, g.materia)
                    g.student_id, g.materia, g.nota, g.cierre_id
                 FROM grades g
                 WHERE g.student_id = ANY($1::int[]) AND g.programa = $2 ${cierreFilter}
                 ORDER BY g.student_id, g.materia,
                    CASE WHEN g.cierre_id IS NOT NULL THEN 0 ELSE 1 END`,
                gradesParams
            );
            grades = rows;
        }

        return res.json({ programa, students, grades });
    } catch (err) {
        console.error('Error en getGradesByProgramaController:', err);
        return res.status(500).json({ error: 'Error obteniendo calificaciones del programa.' });
    }
};

export {
    getGradesController,
    saveGradesController,
    getGradesByStudentIdController,
    getGradesByStudentDocumentController,
    getGradesByProgramaController,
};

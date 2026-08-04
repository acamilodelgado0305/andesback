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
            LEFT JOIN cierres c ON g.cierre_id = c.id
            JOIN materias m ON LOWER(TRIM(g.materia)) = LOWER(TRIM(m.nombre))
            JOIN estudiante_programas ep ON m.programa_id = ep.programa_id
            WHERE g.student_id = $1
              AND ep.estudiante_id = $1
              AND m.activa = true
            ORDER BY COALESCE(c.created_at, NOW()) ASC, g.materia ASC
        `;

        const result = await pool.query(query, [id]);

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
        // Si el portal manda ?studentId=, escopamos a esa institución concreta
        // (un mismo documento puede tener un registro por institución). Si no,
        // caemos al comportamiento anterior (por documento, primero que aparezca).
        const studentIdParam = req.query.studentId;
        const useId = studentIdParam && !isNaN(studentIdParam);

        const studentQuery = `
            SELECT
                s.id,
                s.nombre,
                s.apellido,
                s.numero_documento,
                s.paz_salvo_academico,
                s.paz_salvo_financiero,
                s.paz_salvo_academico_fecha,
                s.paz_salvo_financiero_fecha,
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
            WHERE ${useId ? 's.id = $1' : 'TRIM(CAST(s.numero_documento AS TEXT)) = TRIM($1)'}
            LIMIT 1;
        `;

        const studentResult = await pool.query(
            studentQuery,
            [useId ? parseInt(studentIdParam, 10) : docTrim]
        );

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
            paz_salvo_academico: studentDataFromDB.paz_salvo_academico ?? false,
            paz_salvo_financiero: studentDataFromDB.paz_salvo_financiero ?? false,
            paz_salvo_academico_fecha: studentDataFromDB.paz_salvo_academico_fecha ?? null,
            paz_salvo_financiero_fecha: studentDataFromDB.paz_salvo_financiero_fecha ?? null,
        };

        // Notas del estudiante, filtradas a las materias activas de sus programas.
        // Se agrupan por PERIODO (cierres): el histórico primero y luego los
        // periodos por su `orden` (Periodo 1, 2, 3).
        const gradesQuery = `
            SELECT
                g.materia,
                g.nota,
                COALESCE(c.programa_id, m.programa_id) AS programa_id,
                c.id            AS cierre_id,
                COALESCE(c.nombre, 'En curso')  AS cierre_nombre,
                c.fecha_cierre,
                c.cerrado,
                COALESCE(c.es_historico, false) AS es_historico,
                c.orden         AS cierre_orden,
                COALESCE(c.created_at, NOW())   AS cierre_created_at
            FROM grades g
            LEFT JOIN cierres c     ON g.cierre_id = c.id
            JOIN materias m         ON LOWER(TRIM(g.materia)) = LOWER(TRIM(m.nombre))
            JOIN estudiante_programas ep ON m.programa_id = ep.programa_id
            WHERE g.student_id = $1
              AND ep.estudiante_id = $1
              AND m.activa = true
            ORDER BY es_historico DESC, c.orden ASC NULLS LAST, cierre_created_at ASC, g.materia ASC
        `;

        const gradesResult = await pool.query(gradesQuery, [studentId]);

        // Desglose por TEMA: la nota de una materia en un periodo es el promedio
        // de las evaluaciones que el estudiante respondió en ese periodo, y esas
        // evaluaciones cuelgan de un tema (`modulos` vía `modulo_evaluaciones`).
        // Aquí se reconstruye ese detalle para mostrarlo bajo cada materia.
        // Si una evaluación no está enganchada a ningún tema, se lista con su
        // propio título para no perderla.
        const temasResult = await pool.query(
            `SELECT
                ea.cierre_id,
                mat.nombre                       AS materia,
                COALESCE(md.titulo, e.titulo)    AS tema,
                COALESCE(md.orden, 9999)         AS tema_orden,
                (md.id IS NOT NULL)              AS es_tema,
                ROUND(AVG(ea.calificacion)::numeric, 2) AS nota,
                COUNT(*)                         AS total_evaluaciones
             FROM public.evaluacion_asignaciones ea
             JOIN public.evaluaciones e ON e.id = ea.evaluacion_id
             LEFT JOIN LATERAL (
                 SELECT m2.id, m2.titulo, m2.orden, m2.materia_id
                 FROM public.modulo_evaluaciones me
                 JOIN public.modulos m2 ON m2.id = me.modulo_id
                 WHERE me.evaluacion_id = e.id
                 ORDER BY m2.orden ASC, m2.id ASC
                 LIMIT 1
             ) md ON TRUE
             JOIN public.materias mat ON mat.id = COALESCE(e.materia_id, md.materia_id)
             WHERE ea.estudiante_id = $1
               AND ea.estado = 'finalizada'
               AND ea.calificacion IS NOT NULL
             GROUP BY ea.cierre_id, mat.nombre, md.id, COALESCE(md.titulo, e.titulo),
                      COALESCE(md.orden, 9999)
             ORDER BY tema_orden ASC, tema ASC`,
            [studentId]
        );

        // Indexado por periodo + materia normalizada (grades guarda la materia
        // como texto, igual que el resto de este controlador).
        const claveTema = (cierreId, materia) =>
            `${cierreId ?? 'null'}|${String(materia || '').trim().toLowerCase()}`;
        const temasMap = new Map();
        for (const row of temasResult.rows) {
            const key = claveTema(row.cierre_id, row.materia);
            if (!temasMap.has(key)) temasMap.set(key, []);
            temasMap.get(key).push({
                tema: row.tema,
                nota: row.nota === null ? null : Number(row.nota),
                es_tema: row.es_tema,
                total_evaluaciones: Number(row.total_evaluaciones),
            });
        }

        // Periodo actual por programa (el abierto de menor orden): sirve para que
        // el portal sepa en cuál enfocarse sin recalcularlo en el frontend.
        const periodosActualesResult = await pool.query(
            `SELECT DISTINCT ON (c.programa_id) c.programa_id, c.id
             FROM cierres c
             JOIN estudiante_programas ep ON ep.programa_id = c.programa_id
             WHERE ep.estudiante_id = $1 AND c.cerrado = false AND c.es_historico = false
             ORDER BY c.programa_id, c.orden ASC NULLS LAST, c.created_at ASC`,
            [studentId]
        );
        const periodoActualIds = new Set(periodosActualesResult.rows.map((r) => r.id));

        // Agrupar por periodo
        const cierresMap = new Map();
        for (const row of gradesResult.rows) {
            if (!cierresMap.has(row.cierre_id)) {
                cierresMap.set(row.cierre_id, {
                    cierre_id: row.cierre_id,
                    programa_id: row.programa_id,
                    nombre: row.cierre_nombre,
                    orden: row.cierre_orden,
                    cerrado: row.cerrado ?? null,
                    es_historico: row.es_historico,
                    es_actual: periodoActualIds.has(row.cierre_id),
                    fecha_cierre: row.fecha_cierre,
                    grades: [],
                });
            }
            cierresMap.get(row.cierre_id).grades.push({
                materia: row.materia,
                nota: row.nota,
                temas: temasMap.get(claveTema(row.cierre_id, row.materia)) || [],
            });
        }

        // Promedio de cada periodo (promedio simple de las materias con nota)
        const promedioDe = (items) => {
            const nums = items
                .map((x) => Number(x.nota))
                .filter((n) => !Number.isNaN(n));
            if (nums.length === 0) return null;
            return Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2));
        };

        const gradesByCierre = Array.from(cierresMap.values()).map((c) => ({
            ...c,
            promedio: promedioDe(c.grades),
        }));

        // Nota final acumulada GLOBAL del estudiante: promedio simple de los
        // periodos NO históricos que ya tienen notas (cada periodo pesa igual).
        // OJO: es global a todos sus programas. El portal muestra el acumulado
        // POR PROGRAMA, y lo recalcula en el front sobre los periodos ya
        // filtrados a las materias de ese programa.
        const periodosParaFinal = gradesByCierre.filter(
            (c) => !c.es_historico && c.promedio !== null
        );
        const promedioFinal = periodosParaFinal.length
            ? Number(
                  (
                      periodosParaFinal.reduce((a, c) => a + c.promedio, 0) /
                      periodosParaFinal.length
                  ).toFixed(2)
              )
            : null;

        // Lista plana para el PDF (todas las notas)
        const grades = gradesResult.rows.map((r) => ({ materia: r.materia, nota: r.nota }));

        return res.status(200).json({
            student: studentInfo,
            grades,
            gradesByCierre,
            promedioFinal,
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

import pool from '../database.js'; // Asegúrate de que esta ruta sea correcta

// Helper para manejar errores de forma consistente
const handleServerError = (res, err, message) => {
    console.error(message, err);
    res.status(500).json({
        error: message,
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
};

// =======================================================
// LÓGICA DE CREACIÓN (CREATE)
// =======================================================
const createStudentController = async (req, res) => {
    const {
        nombre,
        apellido,
        email,
        tipoDocumento,
        numeroDocumento,
        lugarExpedicion,
        fechaNacimiento, // Ya viene como Date de Moment en el frontend, se formateará
        lugarNacimiento,
        telefonoLlamadas,
        telefonoWhatsapp,
        simat,
        pagoMatricula, // 'Pagado' o 'Pendiente' (string)
        programasIds, // Array de IDs de programas (INT)
        coordinador_id, // Debería venir el ID numérico del frontend
        modalidad_estudio,
        ultimoCursoVisto,
        eps, // Asegúrate de que estos campos existen en el frontend y la DB
        rh,
        nombreAcudiente,
        tipoDocumentoAcudiente,
        telefonoAcudiente,
        direccionAcudiente,
        // No incluyas 'activo', 'fecha_inscripcion' si son automáticos
    } = req.body;

    // Validaciones básicas (puedes expandir con Joi/Zod para más robustez)
    if (!nombre || !apellido || !email || !numeroDocumento || !programasIds || !Array.isArray(programasIds) || programasIds.length === 0) {
        return res.status(400).json({ error: 'Faltan campos obligatorios o programas de interés.' });
    }
    if (!coordinador_id || typeof coordinador_id !== 'number' || isNaN(coordinador_id)) {
        return res.status(400).json({ error: 'ID de coordinador inválido o no proporcionado.' });
    }

    const estadoMatriculaBoolean = (pagoMatricula === 'Pagado'); // 'Pagado' -> true, 'Pendiente' -> false

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN'); // Iniciar la transacción

        // 1. Insertar el nuevo estudiante
        const studentInsertQuery = `
            INSERT INTO students (
                nombre, apellido, email, tipo_documento, numero_documento, lugar_expedicion,
                fecha_nacimiento, lugar_nacimiento, telefono_llamadas, telefono_whatsapp,
                simat, estado_matricula, coordinador_id, modalidad_estudio,
                ultimo_curso_visto, eps, rh, nombre_acudiente, tipo_documento_acudiente,
                telefono_acudiente, direccion_acudiente, fecha_inscripcion, activo
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, CURRENT_TIMESTAMP, true)
            RETURNING id;
        `;

        const studentResult = await client.query(
            studentInsertQuery,
            [
                nombre, apellido, email, tipoDocumento, numeroDocumento, lugarExpedicion,
                fechaNacimiento, lugarNacimiento, telefonoLlamadas, telefonoWhatsapp,
                simat, estadoMatriculaBoolean, coordinador_id, modalidad_estudio,
                ultimoCursoVisto, eps, rh, nombreAcudiente, tipoDocumentoAcudiente,
                telefonoAcudiente, direccionAcudiente
            ]
        );
        const newStudentId = studentResult.rows[0].id;

        // 2. Insertar las relaciones en la tabla intermedia 'estudiante_programas'
        for (const programaId of programasIds) {
            if (isNaN(parseInt(programaId, 10))) {
                throw new Error(`ID de programa inválido proporcionado: ${programaId}`);
            }
            const programAssignQuery = `
                INSERT INTO estudiante_programas (estudiante_id, programa_id)
                VALUES ($1, $2);
            `;
            await client.query(programAssignQuery, [newStudentId, parseInt(programaId, 10)]);
        }

        await client.query('COMMIT');
        res.status(201).json({ message: "Estudiante y programas asociados creados exitosamente", studentId: newStudentId });

    } catch (err) {
        if (client) await client.query('ROLLBACK');
        handleServerError(res, err, 'Error al crear el estudiante o asociar los programas.');
    } finally {
        if (client) client.release();
    }
};

// =======================================================
// LÓGICA DE OBTENCIÓN (READ) - Todos los estudiantes
// =======================================================
const getStudentsController = async (req, res) => {
    try {
        const query = `
            SELECT
                s.id,
                s.nombre,
                s.apellido,
                s.email,
                s.tipo_documento,
                s.numero_documento,
                s.lugar_expedicion,
                s.fecha_nacimiento,
                s.lugar_nacimiento,
                s.telefono_llamadas,
                s.telefono_whatsapp,
                s.simat,
                s.estado_matricula,
                u.name AS coordinador_nombre, -- Nombre del coordinador
                s.modalidad_estudio,
                s.ultimo_curso_visto,
                s.fecha_inscripcion,
                s.activo,
                s.created_at,
                s.updated_at,
                s.fecha_graduacion,
                s.matricula,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'programa_id', i.id,
                            'nombre_programa', i.nombre,
                            'monto_programa', i.monto
                        )
                        ORDER BY i.nombre
                    ) FILTER (WHERE i.id IS NOT NULL),
                    '[]'::json
                ) AS programas_asociados
            FROM
                students s
            LEFT JOIN
                estudiante_programas ep ON s.id = ep.estudiante_id
            LEFT JOIN
                inventario i ON ep.programa_id = i.id
            LEFT JOIN
                users u ON s.coordinador_id = u.id -- Unir con users para el nombre del coordinador
            GROUP BY
                s.id, u.name -- Agrupar por s.id y u.name
            ORDER BY
                s.nombre, s.apellido;
        `;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (err) {
        handleServerError(res, err, 'Error obteniendo estudiantes y programas asociados.');
    }
};

// =======================================================
// LÓGICA DE OBTENCIÓN (READ) - Por ID de estudiante
// =======================================================
const getStudentByIdController = async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(id)) {
        return res.status(400).json({ error: 'ID de estudiante inválido.' });
    }
    try {
        const query = `
            SELECT
                s.id,
                s.nombre,
                s.apellido,
                s.email,
                s.tipo_documento,
                s.numero_documento,
                s.lugar_expedicion,
                s.fecha_nacimiento,
                s.lugar_nacimiento,
                s.telefono_llamadas,
                s.telefono_whatsapp,
                s.simat,
                s.estado_matricula,
                u.name AS coordinador_nombre, -- Nombre del coordinador
                s.modalidad_estudio,
                s.ultimo_curso_visto,
                s.fecha_inscripcion,
                s.activo,
                s.created_at,
                s.updated_at,
                s.fecha_graduacion,
                s.matricula,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'programa_id', i.id,
                            'nombre_programa', i.nombre,
                            'monto_programa', i.monto
                        )
                        ORDER BY i.nombre
                    ) FILTER (WHERE i.id IS NOT NULL),
                    '[]'::json
                ) AS programas_asociados
            FROM
                students s
            LEFT JOIN
                estudiante_programas ep ON s.id = ep.estudiante_id
            LEFT JOIN
                inventario i ON ep.programa_id = i.id
            LEFT JOIN
                users u ON s.coordinador_id = u.id -- Unir con users para el nombre del coordinador
            WHERE
                s.id = $1
            GROUP BY
                s.id, u.name; -- Agrupar también por u.name
        `;
        const result = await pool.query(query, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Estudiante no encontrado.' });
        }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        handleServerError(res, err, 'Error obteniendo estudiante por ID.');
    }
};

// =======================================================
// LÓGICA DE ACTUALIZACIÓN (UPDATE)
// =======================================================
const updateStudentController = async (req, res) => {
    const { id } = req.params;
    const {
        nombre, apellido, email, tipoDocumento, numeroDocumento, lugarExpedicion,
        fechaNacimiento, lugarNacimiento, telefonoLlamadas, telefonoWhatsapp,
        eps, rh, nombreAcudiente, tipoDocumentoAcudiente, telefonoAcudiente,
        direccionAcudiente, simat, estadoMatricula, // Esto podría ser 'Pagado'/'Pendiente'
        programasIds, // Array de IDs de programas (para actualizar asociaciones)
        coordinador_id, // Recibir el ID del coordinador
        activo, modalidad_estudio, ultimo_curso_visto, matricula // Asegúrate de que 'matricula' sea un INT o numérico
    } = req.body;

    // Validaciones
    if (!id || isNaN(id)) {
        return res.status(400).json({ error: 'ID de estudiante inválido.' });
    }
    if (!nombre || !apellido || !email || !numeroDocumento) {
        return res.status(400).json({ error: 'Campos obligatorios (nombre, apellido, email, número de documento) no pueden estar vacíos.' });
    }
    if (coordinador_id && (typeof coordinador_id !== 'number' || isNaN(coordinador_id))) {
        return res.status(400).json({ error: 'ID de coordinador inválido.' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Formato de email inválido.' });
    }

    const estadoMatriculaBoolean = (estadoMatricula === 'Pagado'); // Convierte a booleano

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // 1. Verificar si el estudiante existe
        const existingStudent = await client.query('SELECT id FROM students WHERE id = $1', [id]);
        if (existingStudent.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Estudiante no encontrado.' });
        }

        // 2. Actualizar datos del estudiante
        const updateStudentQuery = `
            UPDATE students
            SET
                nombre = $1, apellido = $2, email = $3, tipo_documento = $4,
                numero_documento = $5, lugar_expedicion = $6, fecha_nacimiento = $7,
                lugar_nacimiento = $8, telefono_llamadas = $9, telefono_whatsapp = $10,
                eps = $11, rh = $12, nombre_acudiente = $13, tipo_documento_acudiente = $14,
                telefono_acudiente = $15, direccion_acudiente = $16, simat = $17,
                estado_matricula = $18, -- Usar booleano
                coordinador_id = $19, -- Usar el ID numérico
                activo = $20, modalidad_estudio = $21, ultimo_curso_visto = $22,
                matricula = $23, updated_at = CURRENT_TIMESTAMP
            WHERE id = $24
            RETURNING *;
        `;

        const updateParams = [
            nombre, apellido, email, tipoDocumento, numeroDocumento, lugarExpedicion,
            fechaNacimiento, lugarNacimiento, telefonoLlamadas, telefonoWhatsapp,
            eps, rh, nombreAcudiente, tipoDocumentoAcudiente, telefonoAcudiente,
            direccionAcudiente, simat, estadoMatriculaBoolean, coordinador_id, // ¡Aquí va coordinador_id!
            activo, modalidad_estudio, ultimo_curso_visto, matricula, id
        ];

        const result = await client.query(updateStudentQuery, updateParams);

        // 3. Actualizar programas asociados (borrar y reinsertar es común para Many-to-Many simples)
        if (programasIds && Array.isArray(programasIds)) {
            await client.query('DELETE FROM estudiante_programas WHERE estudiante_id = $1', [id]);
            for (const programaId of programasIds) {
                if (isNaN(parseInt(programaId, 10))) {
                    throw new Error(`ID de programa inválido proporcionado: ${programaId}`);
                }
                await client.query(
                    'INSERT INTO estudiante_programas (estudiante_id, programa_id) VALUES ($1, $2)',
                    [id, parseInt(programaId, 10)]
                );
            }
        }

        await client.query('COMMIT');
        res.status(200).json({
            mensaje: 'Estudiante actualizado exitosamente',
            estudiante: result.rows[0]
        });

    } catch (err) {
        if (client) await client.query('ROLLBACK');
        handleServerError(res, err, 'Error interno del servidor al actualizar el estudiante.');
    } finally {
        if (client) client.release();
    }
};

// =======================================================
// LÓGICA DE ELIMINACIÓN (DELETE)
// =======================================================
const deleteStudentController = async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(id)) {
        return res.status(400).json({ error: 'ID de estudiante inválido.' });
    }
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN'); // Iniciar transacción para eliminar relaciones

        // 1. Eliminar las relaciones en 'estudiante_programas'
        await client.query('DELETE FROM estudiante_programas WHERE estudiante_id = $1', [id]);

        // 2. Eliminar el estudiante
        const result = await client.query('DELETE FROM students WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Estudiante no encontrado.' });
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Estudiante y sus asociaciones eliminados exitosamente.', student: result.rows[0] });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        handleServerError(res, err, 'Error eliminando estudiante.');
    } finally {
        if (client) client.release();
    }
};

// =======================================================
// LÓGICA DE ACTUALIZACIÓN DE ESTADO (PATCH)
// =======================================================
const updateEstadoStudentController = async (req, res) => {
    const { id } = req.params;
    const { estado_matricula } = req.body; // Debería ser un booleano (true/false)

    if (!id || isNaN(id)) {
        return res.status(400).json({ error: 'ID de estudiante inválido.' });
    }
    // Puedes añadir más validación aquí para estado_matricula si es un enum o solo booleano
    if (typeof estado_matricula !== 'boolean') {
        return res.status(400).json({ error: 'El estado_matricula debe ser un valor booleano (true/false).' });
    }

    try {
        const result = await pool.query(
            `UPDATE students
            SET estado_matricula = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *`,
            [estado_matricula, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Estudiante no encontrado.' });
        }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        handleServerError(res, err, 'Error actualizando estado de matrícula del estudiante.');
    }
};

// =======================================================
// LÓGICA DE OBTENCIÓN (READ) - Filtrado por Programa
// =======================================================
const getStudentsByProgramaIdController = async (req, res) => {
    const { programaId } = req.params; // Recibimos el ID del programa
    if (!programaId || isNaN(programaId)) {
        return res.status(400).json({ error: 'ID de programa inválido.' });
    }

    try {
        const query = `
            SELECT
                s.*, -- Seleccionamos todas las columnas del estudiante directamente
                u.name AS coordinador_nombre,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'programa_id', i.id,
                            'nombre_programa', i.nombre,
                            'monto_programa', i.monto
                        )
                        ORDER BY i.nombre
                    ) FILTER (WHERE i.id IS NOT NULL),
                    '[]'::json
                ) AS programas_asociados
            FROM
                students s
            LEFT JOIN
                estudiante_programas ep ON s.id = ep.estudiante_id
            LEFT JOIN
                inventario i ON ep.programa_id = i.id
            LEFT JOIN
                users u ON s.coordinador_id = u.id
            WHERE
                ep.programa_id = $1 -- Filtramos por el ID del programa en la tabla intermedia
            GROUP BY
                s.id, u.name
            ORDER BY
                s.nombre, s.apellido;
        `;
        const result = await pool.query(query, [programaId]);
        res.status(200).json(result.rows);
    } catch (err) {
        handleServerError(res, err, 'Error obteniendo estudiantes por ID de programa.');
    }
};

// =======================================================
// LÓGICA DE OBTENCIÓN (READ) - Filtrado por Tipo de Programa (Ej. Bachillerato vs Técnicos)
// =======================================================
const getStudentsByProgramTypeController = async (req, res) => {
    const { tipo } = req.params; // 'bachillerato' o 'tecnicos'

    let programIdForBachillerato;
    try {
        // Primero, obtenemos el ID del programa 'Validación de bachillerato'
        const bachilleratoProgram = await pool.query(
            "SELECT id FROM inventario WHERE nombre = 'Validación de bachillerato';"
        );
        if (bachilleratoProgram.rows.length === 0) {
            return res.status(404).json({ error: 'Programa "Validación de bachillerato" no encontrado en la base de datos.' });
        }
        programIdForBachillerato = bachilleratoProgram.rows[0].id;
    } catch (err) {
        handleServerError(res, err, 'Error al buscar el ID del programa de bachillerato.');
        return;
    }

    let queryCondition = '';
    if (tipo === 'bachillerato') {
        queryCondition = `WHERE ep.programa_id = ${programIdForBachillerato}`;
    } else if (tipo === 'tecnicos') {
        queryCondition = `WHERE ep.programa_id != ${programIdForBachillerato}`;
    } else {
        return res.status(400).json({ error: 'Tipo de programa inválido. Use "bachillerato" o "tecnicos".' });
    }

    try {
        const query = `
            SELECT
                s.*,
                u.name AS coordinador_nombre,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'programa_id', i.id,
                            'nombre_programa', i.nombre,
                            'monto_programa', i.monto
                        )
                        ORDER BY i.nombre
                    ) FILTER (WHERE i.id IS NOT NULL),
                    '[]'::json
                ) AS programas_asociados
            FROM
                students s
            LEFT JOIN
                estudiante_programas ep ON s.id = ep.estudiante_id
            LEFT JOIN
                inventario i ON ep.programa_id = i.id
            LEFT JOIN
                users u ON s.coordinador_id = u.id
            ${queryCondition} -- Condición para filtrar por tipo de programa
            GROUP BY
                s.id, u.name
            ORDER BY
                s.nombre, s.apellido;
        `;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (err) {
        handleServerError(res, err, `Error obteniendo estudiantes por tipo de programa (${tipo}).`);
    }
};


export {
    createStudentController,
    getStudentsController,
    getStudentByIdController,
    updateStudentController,
    deleteStudentController,
    updateEstadoStudentController,
    // Renombre y consolidación de controladores de filtrado
    getStudentsByProgramaIdController, // Nuevo controlador para filtrar por ID de programa específico
    getStudentsByProgramTypeController // Nuevo controlador para filtrar por tipo de programa (bachillerato/tecnicos)
};
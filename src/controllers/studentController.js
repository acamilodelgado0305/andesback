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

    // 1. Extraemos todo de req.body
    const {
        nombre, apellido, email, tipo_documento, numero_documento, lugar_expedicion,
        fecha_nacimiento, lugar_nacimiento, telefono_llamadas, telefono_whatsapp,
        eps, rh, nombre_acudiente, tipo_documento_acudiente, telefono_acudiente,
        direccion_acudiente, simat, estado_matricula,
        programasIds, // ¡Correcto! Ya recibes programasIds
        coordinador_id,
        activo, modalidad_estudio, ultimo_curso_visto, matricula
    } = req.body;

    // Validaciones
    if (!id || isNaN(id)) {
        return res.status(400).json({ error: 'ID de estudiante inválido.' });
    }
    if (!nombre || !apellido || !email || !numero_documento) {
        return res.status(400).json({ error: 'Campos obligatorios (nombre, apellido, email, número de documento) no pueden estar vacíos.' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Formato de email inválido.' });
    }

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // 2. Mapeo explícito y correcto usando las constantes definidas arriba
        // Las claves (izquierda) son los nombres de las columnas en la DB
        const studentFieldsToUpdate = {
            nombre,
            apellido,
            email,
            tipo_documento,
            numero_documento,
            lugar_expedicion,
            fecha_nacimiento,
            lugar_nacimiento,
            telefono_llamadas,
            telefono_whatsapp,
            eps,
            rh,
            nombre_acudiente,
            tipo_documento_acudiente,
            telefono_acudiente,
            direccion_acudiente,
            simat,
            estado_matricula,
            coordinador_id,
            activo,
            modalidad_estudio,
            ultimo_curso_visto,
            matricula
        };

        const setClauses = [];
        const updateParams = [];
        let paramIndex = 1;

        // 3. Construimos la query solo con los campos que realmente se enviaron
        for (const key in studentFieldsToUpdate) {
            if (studentFieldsToUpdate[key] !== undefined) {
                setClauses.push(`${key} = $${paramIndex}`);
                updateParams.push(studentFieldsToUpdate[key]);
                paramIndex++;
            }
        }

        // El resto de tu lógica ya es correcta
        if (setClauses.length > 0) {
            setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
            updateParams.push(id);

            const updateStudentQuery = `
                UPDATE students
                SET ${setClauses.join(', ')}
                WHERE id = $${paramIndex}
                RETURNING *;
            `;

            const result = await client.query(updateStudentQuery, updateParams);
            if (result.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Estudiante no encontrado.' });
            }
        }

        // Actualización de la tabla pivote (esta parte ya estaba bien)
        if (programasIds && Array.isArray(programasIds)) {
            await client.query('DELETE FROM estudiante_programas WHERE estudiante_id = $1', [id]);
            for (const programaId of programasIds) {
                if (isNaN(parseInt(programaId, 10)) || parseInt(programaId, 10) <= 0) {
                    throw new Error(`ID de programa inválido: ${programaId}`);
                }
                await client.query(
                    'INSERT INTO estudiante_programas (estudiante_id, programa_id) VALUES ($1, $2)',
                    [id, parseInt(programaId, 10)]
                );
            }
        }

        await client.query('COMMIT');
        res.status(200).json({ mensaje: 'Estudiante actualizado exitosamente' });

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
        await client.query('BEGIN'); // Iniciar transacción

        // 1. Eliminar los pagos asociados al estudiante (¡NUEVO!)
        await client.query('DELETE FROM pagos WHERE student_id = $1', [id]);

        // 2. Eliminar las relaciones en 'estudiante_programas'
        await client.query('DELETE FROM estudiante_programas WHERE estudiante_id = $1', [id]);

        // 3. Ahora sí, eliminar el estudiante
        const result = await client.query('DELETE FROM students WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Estudiante no encontrado.' });
        }

        await client.query('COMMIT'); // Confirmar todos los cambios
        res.status(200).json({ message: 'Estudiante y todos sus registros asociados han sido eliminados.', student: result.rows[0] });

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

    if (tipo !== 'bachillerato' && tipo !== 'tecnicos') {
        return res.status(400).json({ error: 'Tipo de programa inválido. Use "bachillerato" o "tecnicos".' });
    }

    try {
        // 1. Obtenemos TODOS los IDs de los programas que contienen la palabra "bachillerato".
        // Usamos ILIKE para que la búsqueda no distinga entre mayúsculas y minúsculas.
        const bachilleratoPrograms = await pool.query(
            "SELECT id FROM inventario WHERE nombre ILIKE '%bachillerato%';"
        );

        if (bachilleratoPrograms.rows.length === 0) {
            // Si el tipo es 'bachillerato' y no encontramos programas, devolvemos un array vacío.
            if (tipo === 'bachillerato') {
                return res.status(200).json([]);
            }
            // Si es 'tecnicos', la condición de abajo manejará traerlos todos.
        }

        const bachilleratoProgramIds = bachilleratoPrograms.rows.map(p => p.id);

        // 2. Construimos la condición de la consulta SQL dinámicamente.
        let queryCondition = '';
        if (tipo === 'bachillerato') {
            // Usamos IN para buscar estudiantes cuyo programa_id esté en nuestra lista de IDs.
            // Si no hay IDs de bachillerato, la consulta no devolverá nada, lo cual es correcto.
            queryCondition = bachilleratoProgramIds.length > 0 ? `WHERE s.programa_id IN (${bachilleratoProgramIds.join(',')})` : 'WHERE 1=0'; // Condición falsa para no devolver nada
        } else { // tipo === 'tecnicos'
            // Usamos NOT IN para excluir a los estudiantes de bachillerato.
            // Si no hay IDs de bachillerato, la condición traerá a todos los estudiantes.
            queryCondition = bachilleratoProgramIds.length > 0 ? `WHERE s.programa_id NOT IN (${bachilleratoProgramIds.join(',')})` : '';
        }

        // 3. Ejecutamos la consulta principal, ahora simplificada.
        // Nota: He quitado la tabla 'estudiante_programas' y uso la relación directa.
        const query = `
            SELECT
                s.*,
                u.name AS coordinador_nombre,
                -- Obtenemos el programa directamente desde la tabla de inventario
                json_build_object(
                    'programa_id', i.id,
                    'nombre_programa', i.nombre,
                    'monto_programa', i.monto
                ) AS programa_asociado
            FROM
                students s
            LEFT JOIN
                inventario i ON s.programa_id = i.id
            LEFT JOIN
                users u ON s.coordinador_id = u.id
            ${queryCondition} -- Aplicamos nuestra condición dinámica
            ORDER BY
                s.nombre, s.apellido;
        `;
        
        const result = await pool.query(query);
        res.status(200).json(result.rows);

    } catch (err) {
        // Manejo de errores (asumiendo que tienes una función handleServerError)
        handleServerError(res, err, `Error obteniendo estudiantes por tipo de programa (${tipo}).`);
    }
};



const getStudentsByCoordinatorIdController = async (req, res) => {
    const { coordinatorId } = req.params; // Asume que el ID del coordinador viene en los parámetros de la ruta

    if (!coordinatorId || isNaN(coordinatorId)) {
        return res.status(400).json({ error: 'ID de coordinador inválido o no proporcionado.' });
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
                u.name AS coordinador_nombre,
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
                users u ON s.coordinador_id = u.id
            WHERE
                s.coordinador_id = $1 -- Filtramos por el ID del coordinador
            GROUP BY
                s.id, u.name
            ORDER BY
                s.nombre, s.apellido;
        `;
        const result = await pool.query(query, [coordinatorId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No se encontraron estudiantes para este coordinador.' });
        }

        res.status(200).json(result.rows);
    } catch (err) {
        handleServerError(res, err, 'Error obteniendo estudiantes por ID de coordinador.');
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
    getStudentsByProgramTypeController, // Nuevo controlador para filtrar por tipo de programa (bachillerato/tecnicos)
    getStudentsByCoordinatorIdController
};
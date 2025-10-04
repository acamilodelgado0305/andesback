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
    // 1. Desestructuramos los datos del body, incluyendo 'programasIds'
    const {
        nombre,
        apellido,
        email,
        tipoDocumento,
        numeroDocumento,
        lugarExpedicion,
        fechaNacimiento,
        lugarNacimiento,
        telefonoLlamadas,
        telefonoWhatsapp,
        simat,
        pagoMatricula,
        programasIds, // <-- Leemos 'programasIds' (plural, en array)
        coordinador_id,
        modalidad_estudio,
        ultimo_curso_visto,
        eps,
        rh,
        nombreAcudiente,
        tipoDocumentoAcudiente,
        telefonoAcudiente,
        direccionAcudiente,
    } = req.body;

    // 2. Validación actualizada para verificar el array
    if (!nombre || !apellido || !email || !numeroDocumento || !programasIds || !Array.isArray(programasIds) || programasIds.length === 0) {
        return res.status(400).json({ error: 'Faltan campos obligatorios o el array de programas está vacío.' });
    }

    // 3. Extraemos el primer (y único) ID del array
    const programa_id = programasIds[0];

    const estadoMatriculaBoolean = (pagoMatricula === true || pagoMatricula === 'Pagado');
    const simatBoolean = (simat === true || simat === 'Activo');

    try {
        const studentInsertQuery = `
            INSERT INTO students (
                nombre, apellido, email, tipo_documento, numero_documento, lugar_expedicion,
                fecha_nacimiento, lugar_nacimiento, telefono_llamadas, telefono_whatsapp,
                simat, estado_matricula, coordinador_id, modalidad_estudio,
                ultimo_curso_visto, eps, rh, nombre_acudiente, tipo_documento_acudiente,
                telefono_acudiente, direccion_acudiente, programa_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
            RETURNING id;
        `;

        const studentResult = await pool.query(
            studentInsertQuery,
            [
                nombre, apellido, email, tipoDocumento, numeroDocumento, lugarExpedicion,
                fechaNacimiento, lugarNacimiento, telefonoLlamadas, telefonoWhatsapp,
                simatBoolean, estadoMatriculaBoolean, coordinador_id, modalidad_estudio,
                ultimo_curso_visto, eps, rh, nombreAcudiente, tipoDocumentoAcudiente,
                telefonoAcudiente, direccionAcudiente,
                programa_id // <-- Usamos la variable con el ID extraído
            ]
        );
        
        const newStudentId = studentResult.rows[0].id;
        res.status(201).json({ message: "Estudiante creado exitosamente", studentId: newStudentId });

    } catch (err) {
        console.error('Error al crear el estudiante:', err);
        if (err.code === '23505') { 
            return res.status(409).json({ error: `Ya existe un estudiante con ese email o documento.` });
        }
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

// =======================================================
// LÓGICA DE OBTENCIÓN (READ) - Todos los estudiantes
// =======================================================
const getStudentsController = async (req, res) => {
    try {
        // QUERY CORREGIDA: Un JOIN simple que refleja la relación actual.
        const query = `
            SELECT
                s.*,
                u.name AS coordinador_nombre,

                -- Obtenemos los detalles del programa asociado directamente
                i.id AS programa_id,
                i.nombre AS programa_nombre,
                i.monto AS programa_monto,
                i.descripcion AS programa_descripcion
            FROM
                students s
            LEFT JOIN users u ON s.coordinador_id = u.id
            LEFT JOIN inventario i ON s.programa_id = i.id -- Join directo
            ORDER BY
                s.nombre, s.apellido;
        `;

        const { rows } = await pool.query(query);
        res.status(200).json(rows);

    } catch (err) {
        console.error('Error obteniendo la lista de estudiantes:', err);
        res.status(500).json({ error: 'Error interno del servidor al obtener los estudiantes.' });
    }
};



const getStudentsByCoordinatorIdController = async (req, res) => {
    const { coordinatorId } = req.params;

    if (!coordinatorId || isNaN(coordinatorId)) {
        return res.status(400).json({ error: 'ID de coordinador inválido o no proporcionado.' });
    }

    try {
        // QUERY CORREGIDA: Usamos el JOIN simple y directo, añadiendo el filtro WHERE.
        const query = `
            SELECT
                s.*,
                u.name AS coordinador_nombre,

                -- Obtenemos los detalles del programa asociado directamente
                i.id AS programa_id,
                i.nombre AS programa_nombre,
                i.monto AS programa_monto,
                i.descripcion AS programa_descripcion
            FROM
                students s
            LEFT JOIN users u ON s.coordinador_id = u.id
            LEFT JOIN inventario i ON s.programa_id = i.id -- Join directo
            WHERE
                s.coordinador_id = $1 -- Filtro por coordinador
            ORDER BY
                s.nombre, s.apellido;
        `;

        const { rows } = await pool.query(query, [coordinatorId]);

        // Devolver las filas (será un array vacío si el coordinador no tiene estudiantes, lo cual es correcto)
        res.status(200).json(rows);

    } catch (err) {
        console.error('Error obteniendo estudiantes por coordinador:', err);
        res.status(500).json({ error: 'Error interno del servidor al obtener estudiantes por coordinador.' });
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
        // 1. QUERY CORREGIDA Y SIMPLIFICADA
        // Usamos un simple LEFT JOIN para obtener los datos del programa.
        const query = `
            SELECT
                s.*, -- Todos los campos del estudiante
                
                -- Campos del Coordinador
                u.id AS coordinador_id, 
                u.name AS coordinador_nombre,
                
                -- Campos del Negocio (a través del coordinador)
                b.id AS business_id, 
                b.name AS business_name,
                b.profile_picture_url AS business_profile_picture_url,

                -- Campos del Programa (a través del JOIN directo)
                i.id AS programa_id_actual, 
                i.nombre AS nombre_programa, 
                i.monto AS monto_programa
            FROM
                students s
            LEFT JOIN users u ON s.coordinador_id = u.id
            LEFT JOIN businesses b ON u.business_id = b.id
            -- Unimos directamente con inventario usando la columna programa_id del estudiante
            LEFT JOIN inventario i ON s.programa_id = i.id
            WHERE
                s.id = $1;
        `;

        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Estudiante no encontrado.' });
        }

        const flatStudent = result.rows[0];

        // 2. CÓDIGO DE MAPEO AJUSTADO
        // Construimos el objeto de respuesta final anidando la información.
        const studentResponse = {
            id: flatStudent.id,
            nombre: flatStudent.nombre,
            apellido: flatStudent.apellido,
            email: flatStudent.email,
            tipo_documento: flatStudent.tipo_documento,
            numero_documento: flatStudent.numero_documento,
            lugar_expedicion: flatStudent.lugar_expedicion,
            fecha_nacimiento: flatStudent.fecha_nacimiento,
            lugar_nacimiento: flatStudent.lugar_nacimiento,
            telefono_llamadas: flatStudent.telefono_llamadas,
            telefono_whatsapp: flatStudent.telefono_whatsapp,
            telefono: flatStudent.telefono,
            simat: flatStudent.simat,
            estado_matricula: flatStudent.estado_matricula,
            matricula: flatStudent.matricula,
            modalidad_estudio: flatStudent.modalidad_estudio,
            ultimo_curso_visto: flatStudent.ultimo_curso_visto,
            fecha_inscripcion: flatStudent.fecha_inscripcion,
            fecha_graduacion: flatStudent.fecha_graduacion,
            activo: flatStudent.activo,
            eps: flatStudent.eps,
            rh: flatStudent.rh,
            documento_url: flatStudent.documento,
            created_at: flatStudent.created_at,
            updated_at: flatStudent.updated_at,
            acudiente: flatStudent.nombre_acudiente ? {
                nombre: flatStudent.nombre_acudiente,
                tipo_documento: flatStudent.tipo_documento_acudiente,
                telefono: flatStudent.telefono_acudiente,
                direccion: flatStudent.direccion_acudiente
            } : null,
            coordinador: flatStudent.coordinador_id ? {
                id: flatStudent.coordinador_id,
                nombre: flatStudent.coordinador_nombre
            } : null,
            business: flatStudent.business_id ? {
                id: flatStudent.business_id,
                name: flatStudent.business_name,
                profilePictureUrl: flatStudent.business_profile_picture_url
            } : null,
            // Creamos un objeto para el programa en lugar de un array
            programa_asociado: flatStudent.programa_id_actual ? {
                programa_id: flatStudent.programa_id_actual,
                nombre_programa: flatStudent.nombre_programa,
                monto_programa: flatStudent.monto_programa
            } : null
        };

        res.status(200).json(studentResponse);

    } catch (err) {
        console.error('Error obteniendo estudiante por ID:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};


/**
 * Controlador para obtener un estudiante por su número de documento.
 * @param {object} req - El objeto de solicitud de Express.
 * @param {object} res - El objeto de respuesta de Express.
 */
const getStudentByDocumentController = async (req, res) => {
    // 1. Obtenemos el número de documento de los parámetros de la URL.
    const { numero_documento } = req.params;

    // 2. Validación básica para asegurarnos de que el parámetro no esté vacío.
    if (!numero_documento) {
        return res.status(400).json({ error: 'El número de documento es requerido.' });
    }

    try {
        // 3. Utilizamos tu query original, pero modificamos el WHERE.
        //    Buscamos por `s.numero_documento` en lugar de `s.id`.
        const query = `
            SELECT
                s.id, s.nombre, s.apellido, s.email, s.tipo_documento,
                s.numero_documento, s.lugar_expedicion, s.fecha_nacimiento,
                s.lugar_nacimiento, s.telefono_llamadas, s.telefono_whatsapp,
                s.simat, s.estado_matricula, s.modalidad_estudio,
                s.ultimo_curso_visto, s.fecha_inscripcion, s.activo,
                s.telefono, s.numero_documento, s.fecha_graduacion, 
                s.matricula, s.eps, s.rh, s.documento, 
                s.created_at, s.updated_at,
                s.nombre_acudiente, s.tipo_documento_acudiente,
                s.telefono_acudiente, s.direccion_acudiente,
                u.id AS coordinador_id, u.name AS coordinador_nombre,
                b.id AS business_id, b.name AS business_name,
                b.profile_picture_url AS business_profile_picture_url,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'programa_id', i.id,
                            'nombre_programa', i.nombre,
                            'monto_programa', i.monto
                        )
                    ) FILTER (WHERE i.id IS NOT NULL),
                    '[]'::json
                ) AS programas_asociados
            FROM
                students s
            LEFT JOIN users u ON s.coordinador_id = u.id
            LEFT JOIN businesses b ON u.business_id = b.id
            LEFT JOIN estudiante_programas ep ON s.id = ep.estudiante_id
            LEFT JOIN inventario i ON ep.programa_id = i.id
            WHERE
                s.numero_documento = $1  -- ¡Este es el cambio clave!
            GROUP BY
                s.id, u.id, b.id;
        `;

        const result = await pool.query(query, [numero_documento]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Estudiante no encontrado con ese número de documento.' });
        }

        const flatStudent = result.rows[0];

        // 4. Mantenemos la misma estructura de respuesta para consistencia en la API.
        const studentResponse = {
            id: flatStudent.id,
            nombre: flatStudent.nombre,
            apellido: flatStudent.apellido,
            email: flatStudent.email,
            tipo_documento: flatStudent.tipo_documento,
            numero_documento: flatStudent.numero_documento,
            lugar_expedicion: flatStudent.lugar_expedicion,
            fecha_nacimiento: flatStudent.fecha_nacimiento,
            lugar_nacimiento: flatStudent.lugar_nacimiento,
            telefono_llamadas: flatStudent.telefono_llamadas,
            telefono_whatsapp: flatStudent.telefono_whatsapp,
            telefono: flatStudent.telefono,
            numero_documento: flatStudent.numero_documento,
            simat: flatStudent.simat,
            estado_matricula: flatStudent.estado_matricula,
            matricula: flatStudent.matricula,
            modalidad_estudio: flatStudent.modalidad_estudio,
            ultimo_curso_visto: flatStudent.ultimo_curso_visto,
            fecha_inscripcion: flatStudent.fecha_inscripcion,
            fecha_graduacion: flatStudent.fecha_graduacion,
            activo: flatStudent.activo,
            eps: flatStudent.eps,
            rh: flatStudent.rh,
            documento_url: flatStudent.documento,
            created_at: flatStudent.created_at,
            updated_at: flatStudent.updated_at,
            acudiente: flatStudent.nombre_acudiente ? {
                nombre: flatStudent.nombre_acudiente,
                tipo_documento: flatStudent.tipo_documento_acudiente,
                telefono: flatStudent.telefono_acudiente,
                direccion: flatStudent.direccion_acudiente
            } : null,
            coordinador: flatStudent.coordinador_id ? {
                id: flatStudent.coordinador_id,
                nombre: flatStudent.coordinador_nombre
            } : null,
            business: flatStudent.business_id ? {
                id: flatStudent.business_id,
                name: flatStudent.business_name,
                profilePictureUrl: flatStudent.business_profile_picture_url
            } : null,
            programas_asociados: flatStudent.programas_asociados
        };

        res.status(200).json(studentResponse);

    } catch (err) {
        console.error('Error obteniendo estudiante por número de documento:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
// =======================================================
// LÓGICA DE ACTUALIZACIÓN (UPDATE)
// =======================================================
/**
 * Controlador para actualizar un estudiante y sincronizar sus programas asociados.
 * Utiliza una transacción para garantizar la integridad de los datos y un bulk insert
 * para una actualización eficiente de los programas.
 */
const updateStudentController = async (req, res) => {
    // Extraemos el ID del estudiante de los parámetros de la URL
    const { id } = req.params;

    // Capturamos todo el cuerpo de la petición que contiene los datos a actualizar
    const studentData = req.body;

    // --- Validaciones Esenciales ---
    // Es crucial validar que el ID sea un número válido antes de proceder.
    if (!id || isNaN(parseInt(id, 10))) {
        return res.status(400).json({ error: 'ID de estudiante inválido o no proporcionado.' });
    }
    // Aquí puedes agregar más validaciones (ej. con Joi o Zod) para los campos del body.

    let client;
    try {
        // Obtenemos una conexión del pool para manejar la transacción
        client = await pool.connect();
        // Iniciamos la transacción
        await client.query('BEGIN');

        // --- 1. Actualización de la tabla 'students' ---

        // Separamos los Ids de los programas del resto de los datos del estudiante
        const { programasIds, ...studentFieldsToUpdate } = studentData;

        const setClauses = [];
        const updateParams = [];
        let paramIndex = 1;

        // Construimos la consulta UPDATE dinámicamente solo con los campos que se enviaron
        for (const key in studentFieldsToUpdate) {
            // Verificamos que el campo realmente exista en el body (no es undefined)
            if (studentFieldsToUpdate[key] !== undefined) {
                // Asumimos que los nombres de las columnas en la DB son snake_case (ej. tipo_documento)
                // y los del frontend son camelCase (ej. tipoDocumento). Esta línea convierte el formato.
                const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

                setClauses.push(`${dbKey} = $${paramIndex}`);
                updateParams.push(studentFieldsToUpdate[key]);
                paramIndex++;
            }
        }

        // Solo ejecutamos la consulta UPDATE si hay al menos un campo para actualizar
        if (setClauses.length > 0) {
            // Agregamos la actualización de la fecha de modificación
            setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
            // El último parámetro siempre será el ID del estudiante para la cláusula WHERE
            updateParams.push(id);

            const updateStudentQuery = `
                UPDATE students
                SET ${setClauses.join(', ')}
                WHERE id = $${paramIndex}
            `;

            await client.query(updateStudentQuery, updateParams);
        }

        // --- 2. Sincronización de la tabla 'estudiante_programas' ---

        // Esta lógica solo se ejecuta si el array 'programasIds' fue incluido en la petición
        if (programasIds && Array.isArray(programasIds)) {
            // Paso A: Borramos todas las asociaciones existentes para este estudiante.
            // Esto simplifica la lógica y asegura que solo queden las nuevas asociaciones.
            // Funciona correctamente incluso si no hay ninguna fila que borrar.
            await client.query('DELETE FROM estudiante_programas WHERE estudiante_id = $1', [id]);

            // Paso B: Si el array no está vacío, insertamos las nuevas asociaciones.
            if (programasIds.length > 0) {
                // MEJORA CLAVE: Creamos una única consulta "bulk insert".
                // Es mucho más eficiente que hacer un INSERT por cada programa en un bucle.

                // Construye los placeholders: ($1, $2), ($1, $3), ($1, $4), etc.
                const valuesClauses = programasIds.map((_, index) => `($1, $${index + 2})`).join(', ');

                // Crea el array de valores: [estudianteId, programaId1, programaId2, ...]
                const programInsertValues = [id, ...programasIds];

                const programAssignQuery = `
                    INSERT INTO estudiante_programas (estudiante_id, programa_id)
                    VALUES ${valuesClauses};
                `;

                await client.query(programAssignQuery, programInsertValues);
            }
        }

        // Si todo salió bien, confirmamos los cambios en la base de datos
        await client.query('COMMIT');

        res.status(200).json({ message: 'Estudiante actualizado exitosamente' });

    } catch (err) {
        // Si ocurre cualquier error, revertimos todos los cambios de la transacción
        if (client) {
            await client.query('ROLLBACK');
        }

        // Usamos un manejador de errores centralizado para responder al cliente
        handleServerError(res, err, 'Error interno del servidor al actualizar el estudiante.');

    } finally {
        // Es fundamental liberar la conexión al pool, tanto si hubo éxito como si hubo error.
        if (client) {
            client.release();
        }
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
    const { tipo } = req.params;
    const { activo, modalidad } = req.query;

    if (tipo !== 'bachillerato' && tipo !== 'tecnicos') {
        return res.status(400).json({ error: 'Tipo de programa inválido. Use "bachillerato" o "tecnicos".' });
    }

    const programTypeFilter = tipo === 'bachillerato' ? 'Validacion' : 'Tecnico';

    try {
        // ✅ CONSULTA FINAL Y CORRECTA PARA TU ESQUEMA
        const query = `
            -- 1. Usamos tu lógica original para encontrar los IDs de los programas correctos
            WITH programas_filtrados AS (
                SELECT id 
                FROM inventario
                WHERE
                    CASE
                        WHEN nombre ILIKE '%bachillerato%' THEN 'Validacion'
                        ELSE 'Tecnico'
                    END = $1
            )
            -- 2. Seleccionamos los estudiantes y unimos con inventario para obtener el nombre del programa
            SELECT
                s.id, s.nombre, s.apellido, s.email, s.telefono_whatsapp,
                s.activo, s.modalidad_estudio,
                i.nombre AS nombre_programa
            FROM
                students s
            JOIN 
                inventario i ON s.programa_id = i.id
            WHERE
                -- 3. La condición clave: El programa del estudiante DEBE ESTAR EN la lista que filtramos
                s.programa_id IN (SELECT id FROM programas_filtrados)
                
                -- Tus filtros opcionales (ya estaban bien)
                AND ($2::TEXT IS NULL OR s.activo::TEXT = $2::TEXT)
                AND ($3::TEXT IS NULL OR s.modalidad_estudio = $3)
            ORDER BY
                s.apellido, s.nombre;
        `;
        
        const values = [
            programTypeFilter,
            activo,
            modalidad
        ];
        
        const result = await pool.query(query, values);
        res.status(200).json(result.rows);

    } catch (err) {
        console.error(`Error en getStudentsByProgramTypeController (${tipo}):`, err);
        res.status(500).json({ error: 'Error interno del servidor.' });
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
    getStudentsByCoordinatorIdController,
    getStudentByDocumentController
};
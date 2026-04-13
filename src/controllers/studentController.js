import pool from '../database.js';
import { uploadStudentDocumentToGCS, deleteStudentDocumentFromGCS } from '../services/gcsStudentDocuments.js';
import { getUsersMapFromAuthService } from '../services/authServiceClient.js';

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
const insertStudentToDB = async (studentData, res) => {
  const {
    nombre, apellido, email, tipoDocumento, numeroDocumento,
    lugarExpedicion, fechaNacimiento, lugarNacimiento,
    telefonoLlamadas, telefonoWhatsapp, simat, pagoMatricula,
    programasIds, coordinador_id, modalidad_estudio, ultimo_curso_visto,
    eps, rh, nombreAcudiente, tipoDocumentoAcudiente,
    telefonoAcudiente, direccionAcudiente, posibleGraduacion,
    business_id
  } = studentData;

  // 1. Validaciones básicas de integridad
  if (!coordinador_id) {
    return res.status(400).json({ error: "El ID del coordinador es obligatorio para crear un estudiante." });
  }

  // Sanitizar programas
  let sanitizedProgramIds = [];
  if (Array.isArray(programasIds)) {
    sanitizedProgramIds = [...new Set(programasIds.map(p => parseInt(p, 10)).filter(p => !isNaN(p)))];
  }

  if (!nombre || !apellido || !email || !numeroDocumento || sanitizedProgramIds.length === 0) {
    return res.status(400).json({ error: "Faltan campos obligatorios o no hay programas seleccionados." });
  }

  const estadoMatriculaBoolean = pagoMatricula === true || pagoMatricula === "Pagado";
  const simatBoolean = simat === true || simat === "Activo";
  const posibleGraduacionBoolean = posibleGraduacion === true;

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");

    // 2. Insertar Estudiante
    const studentInsertQuery = `
      INSERT INTO students (
        nombre, apellido, email, tipo_documento, numero_documento,
        lugar_expedicion, fecha_nacimiento, lugar_nacimiento,
        telefono_llamadas, telefono_whatsapp, simat, estado_matricula,
        coordinador_id, modalidad_estudio, ultimo_curso_visto,
        eps, rh, nombre_acudiente, tipo_documento_acudiente,
        telefono_acudiente, direccion_acudiente, posible_graduacion,
        business_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23
      ) RETURNING id;
    `;

    const values = [
      nombre, apellido, email, tipoDocumento, numeroDocumento,
      lugarExpedicion, fechaNacimiento, lugarNacimiento,
      telefonoLlamadas, telefonoWhatsapp, simatBoolean, estadoMatriculaBoolean,
      coordinador_id, modalidad_estudio || null, ultimo_curso_visto || null,
      eps || null, rh || null, nombreAcudiente || null, tipoDocumentoAcudiente || null,
      telefonoAcudiente || null, direccionAcudiente || null, posibleGraduacionBoolean,
      business_id || null
    ];

    const studentResult = await client.query(studentInsertQuery, values);
    const newStudentId = studentResult.rows[0].id;

    // 3. Insertar Programas (Relación M:N)
    if (sanitizedProgramIds.length > 0) {
      const valuesClauses = sanitizedProgramIds.map((_, i) => `($1, $${i + 2})`).join(", ");
      const programAssignQuery = `
        INSERT INTO estudiante_programas (estudiante_id, programa_id)
        VALUES ${valuesClauses};
      `;
      await client.query(programAssignQuery, [newStudentId, ...sanitizedProgramIds]);
    }

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Estudiante registrado exitosamente",
      studentId: newStudentId
    });

  } catch (err) {
    if (client) await client.query("ROLLBACK");

    // Manejo de error de duplicados (Email o Documento)
    if (err.code === "23505") {
      return res.status(409).json({ error: "Ya existe un estudiante con ese documento o correo electrónico." });
    }

    console.error("Error BD creando estudiante:", err);
    return res.status(500).json({ error: "Error interno al procesar el registro." });
  } finally {
    if (client) client.release();
  }
};

// =======================================================
// CONTROLADOR 1: Creación Autenticada (Desde Panel)
// =======================================================
export const createStudentAuthenticated = async (req, res) => {
  try {
    const userId     = req.user.id;
    const userRole   = req.user.role;
    const businessId = req.user.bid;

    if (!businessId) {
      return res.status(400).json({ error: "Token sin business asociado." });
    }

    const isAdmin = userRole === 'admin' || userRole === 'superadmin';

    // Admin/superadmin: usa coordinador_id del body.
    // Otros roles: se fuerza su propio userId como coordinador.
    const finalCoordinatorId = (isAdmin && req.body.coordinador_id)
      ? req.body.coordinador_id
      : userId;

    const studentData = {
      ...req.body,
      coordinador_id: finalCoordinatorId,
      business_id: businessId          // ← siempre del token
    };

    return await insertStudentToDB(studentData, res);

  } catch (error) {
    console.error("Error en createStudentAuthenticated:", error);
    return res.status(500).json({ error: "Error de servidor en creación autenticada" });
  }
};

// =======================================================
// CONTROLADOR 2: Creación Pública (Formulario Externo)
// =======================================================
export const createStudentPublic = async (req, res) => {
  try {
    // En el registro público, el coordinador_id DEBE venir en el body
    // (ej. campo oculto en el formulario o seleccionado por el usuario)
    if (!req.body.coordinador_id) {
      // Opcional: Podrías asignar un ID por defecto aquí si lo deseas (ej. ID del admin)
      // const DEFAULT_PUBLIC_COORD_ID = 1; 
      return res.status(400).json({
        error: "Se requiere especificar un código de coordinador o sede para el registro."
      });
    }

    // Pasamos los datos directamente
    return await insertStudentToDB(req.body, res);

  } catch (error) {
    console.error("Error en createStudentPublic:", error);
    return res.status(500).json({ error: "Error de servidor en registro público" });
  }
};




// =======================================================
// LÓGICA DE OBTENCIÓN (READ) - Todos los estudiantes
// =======================================================
export const getStudentsController = async (req, res) => {
  try {
    const userId     = req.user?.id;
    const userRole   = req.user?.role;
    const businessId = req.user?.bid;

    if (!userId)     return res.status(401).json({ error: "Usuario no autenticado." });
    if (!businessId) return res.status(400).json({ error: "Token sin business asociado." });

    const isAdmin = userRole === 'admin' || userRole === 'superadmin';

    // Siempre filtramos por business_id del token.
    // Admin/superadmin: todos los estudiantes de ese business.
    // Otros roles: solo sus estudiantes (por coordinador_id) dentro del business.
    const conditions  = ['s.business_id = $1'];
    const queryParams = [businessId];

    if (!isAdmin) {
      conditions.push('s.coordinador_id = $2');
      queryParams.push(userId);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Sin subquery a tabla "users" (no existe en esta BD).
    // Los nombres de coordinadores se enriquecen en JS vía auth-service.
    const query = `
      SELECT
        s.*,
        COALESCE(
          (
            SELECT json_agg(json_build_object(
              'programa_id',    p.id,
              'nombre',         p.nombre,
              'tipo_programa',  p.tipo_programa,
              'duracion_meses', p.duracion_meses
            ))
            FROM estudiante_programas ep
            JOIN programas p ON ep.programa_id = p.id
            WHERE ep.estudiante_id = s.id
          ),
          '[]'::json
        ) AS programas_asociados
      FROM students s
      ${whereClause}
      ORDER BY s.created_at DESC;
    `;

    const { rows } = await pool.query(query, queryParams);

    // Enriquecer con nombres de coordinadores desde auth-service
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const usersMap = await getUsersMapFromAuthService(token);

    const enrichedRows = rows.map((row) => ({
      ...row,
      coordinador_nombre: usersMap.get(Number(row.coordinador_id)) || null,
    }));

    return res.status(200).json(enrichedRows);
  } catch (err) {
    console.error("Error obteniendo la lista de estudiantes:", err);
    return res
      .status(500)
      .json({ error: "Error interno del servidor al obtener los estudiantes." });
  }
};




// ... (dentro de tu archivo de controllers)

export const getStudentsByCoordinatorIdController = async (req, res) => {
  const { coordinatorId } = req.params;

  // ✅ Normalizamos y validamos ID de coordinador
  const coordId = parseInt(coordinatorId, 10);
  if (!coordId || isNaN(coordId)) {
    return res
      .status(400)
      .json({ error: "ID de coordinador inválido o no proporcionado." });
  }

  try {
    const query = `
      SELECT
        s.*,
        u.name AS coordinador_nombre,

        -- ✅ Agregación de TODOS los programas asociados (tabla estudiante_programas)
        COALESCE(
          json_agg(
            json_build_object(
              'programa_id', p.id,
              'nombre', p.nombre,
              'tipo_programa', p.tipo_programa,
              'duracion_meses', p.duracion_meses
            )
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'::json
        ) AS programas_asociados

      FROM
        students s
      LEFT JOIN users u ON s.coordinador_id = u.id
      LEFT JOIN estudiante_programas ep ON s.id = ep.estudiante_id
      LEFT JOIN programas p ON ep.programa_id = p.id

      WHERE
        s.coordinador_id = $1

      GROUP BY
        s.id, u.name

      ORDER BY
        s.nombre, s.apellido;
    `;

    const { rows } = await pool.query(query, [coordId]);

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No se encontraron estudiantes para este coordinador." });
    }

    // 🔥 rows ya viene en el formato que tu StudentTable necesita:
    // - nombre, apellido, etc (de students s.*)
    // - coordinador_nombre
    // - programas_asociados: [{ programa_id, nombre, tipo_programa, duracion_meses }, ...]
    return res.status(200).json(rows);
  } catch (err) {
    console.error("Error obteniendo estudiantes por coordinador:", err);
    return res.status(500).json({
      error: "Error interno del servidor al obtener estudiantes por coordinador.",
    });
  }
};





export const getStudentByIdController = async (req, res) => {
  const { id } = req.params;

  // ✅ Normalizamos y validamos ID
  const studentId = parseInt(id, 10);
  if (!studentId || isNaN(studentId)) {
    return res.status(400).json({ error: "ID de estudiante inválido." });
  }

  try {
    // Sin LEFT JOIN a 'users' (no existe en esta BD).
    // El nombre del coordinador se enriquece desde auth-service tras la consulta.
    const query = `
      SELECT
        s.*,
        COALESCE(
          json_agg(
            json_build_object(
              'programa_id',    p_assoc.id,
              'nombre',         p_assoc.nombre,
              'tipo_programa',  p_assoc.tipo_programa,
              'duracion_meses', p_assoc.duracion_meses
            )
          ) FILTER (WHERE p_assoc.id IS NOT NULL),
          '[]'::json
        ) AS programas_asociados
      FROM students s
      LEFT JOIN estudiante_programas ep ON s.id = ep.estudiante_id
      LEFT JOIN programas p_assoc ON ep.programa_id = p_assoc.id
      WHERE s.id = $1
      GROUP BY s.id;
    `;

    const result = await pool.query(query, [studentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Estudiante no encontrado." });
    }

    const flatStudent = result.rows[0];

    // Enriquecer nombre del coordinador desde auth-service
    let coordinadorNombre = null;
    if (flatStudent.coordinador_id) {
      const authHeader = req.headers['authorization'] || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      if (token) {
        const usersMap = await getUsersMapFromAuthService(token);
        coordinadorNombre = usersMap.get(Number(flatStudent.coordinador_id)) || null;
      }
    }

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
      business_id: flatStudent.business_id,
      documento_url: flatStudent.documento,
      created_at: flatStudent.created_at,
      updated_at: flatStudent.updated_at,
      posible_graduacion: flatStudent.posible_graduacion,

      acudiente: flatStudent.nombre_acudiente ? {
        nombre:        flatStudent.nombre_acudiente,
        tipo_documento:flatStudent.tipo_documento_acudiente,
        telefono:      flatStudent.telefono_acudiente,
        direccion:     flatStudent.direccion_acudiente,
      } : null,

      coordinador: flatStudent.coordinador_id ? {
        id:     flatStudent.coordinador_id,
        nombre: coordinadorNombre,
      } : null,

      programas_asociados: Array.isArray(flatStudent.programas_asociados)
        ? flatStudent.programas_asociados
        : [],
    };

    return res.status(200).json(studentResponse);
  } catch (err) {
    console.error("Error obteniendo estudiante por ID:", err);
    return res.status(500).json({ error: "Error interno del servidor" });
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
    // Sin LEFT JOIN a 'users' ni 'inventario' (no existen en esta BD).
    const query = `
      SELECT
        s.*,
        COALESCE(
          json_agg(
            json_build_object(
              'programa_id',   p.id,
              'nombre',        p.nombre,
              'tipo_programa', p.tipo_programa
            )
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'::json
        ) AS programas_asociados
      FROM students s
      LEFT JOIN estudiante_programas ep ON s.id = ep.estudiante_id
      LEFT JOIN programas p ON ep.programa_id = p.id
      WHERE s.numero_documento = $1
      GROUP BY s.id;
    `;

    const result = await pool.query(query, [numero_documento]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado con ese número de documento.' });
    }

    const flatStudent = result.rows[0];

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
      business_id: flatStudent.business_id,
      documento_url: flatStudent.documento,
      created_at: flatStudent.created_at,
      updated_at: flatStudent.updated_at,
      posible_graduacion: flatStudent.posible_graduacion,
      acudiente: flatStudent.nombre_acudiente ? {
        nombre:         flatStudent.nombre_acudiente,
        tipo_documento: flatStudent.tipo_documento_acudiente,
        telefono:       flatStudent.telefono_acudiente,
        direccion:      flatStudent.direccion_acudiente,
      } : null,
      coordinador: flatStudent.coordinador_id ? {
        id:     flatStudent.coordinador_id,
        nombre: null, // enriquecible desde auth-service si se necesita
      } : null,
      programas_asociados: Array.isArray(flatStudent.programas_asociados)
        ? flatStudent.programas_asociados
        : [],
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
export const updateStudentController = async (req, res) => {
  const { id } = req.params;
  const studentData = req.body;

  // ✅ Validación y normalización del ID
  const studentId = parseInt(id, 10);
  if (!studentId || isNaN(studentId)) {
    return res
      .status(400)
      .json({ error: "ID de estudiante inválido o no proporcionado." });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");

    // Separamos los programas de los demás campos
    const { programasIds, ...studentFieldsToUpdate } = studentData;

    const setClauses = [];
    const updateParams = [];
    let paramIndex = 1;

    // ✅ Construimos dinámicamente el UPDATE de students
    for (const key in studentFieldsToUpdate) {
      if (!Object.prototype.hasOwnProperty.call(studentFieldsToUpdate, key)) {
        continue;
      }

      const value = studentFieldsToUpdate[key];

      // Ignoramos campos undefined y el id
      if (value === undefined || key === "id") continue;

      // camelCase -> snake_case
      const dbKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

      // 🚫 IMPORTANTE: ignorar cualquier campo que termine siendo programa_id
      if (dbKey === "programa_id") {
        console.log(
          `[updateStudentController] Ignorando campo legado '${key}' -> '${dbKey}' porque la columna programa_id ya no existe en students`
        );
        continue;
      }

      setClauses.push(`${dbKey} = $${paramIndex}`);
      updateParams.push(value);
      paramIndex++;
    }

    if (setClauses.length > 0) {
      // ✅ updated_at sin parámetro adicional
      setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
      // El ID va al final
      updateParams.push(studentId);

      const updateStudentQuery = `
        UPDATE students
        SET ${setClauses.join(", ")}
        WHERE id = $${paramIndex}
      `;

      await client.query(updateStudentQuery, updateParams);
    }

    // ✅ Sincronizamos estudiante_programas SOLO si llega programasIds en el body
    if (programasIds !== undefined) {
      if (!Array.isArray(programasIds)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "El campo programasIds debe ser un arreglo de IDs de programas.",
        });
      }

      // Normalizamos: números, únicos y válidos
      const sanitizedProgramIds = [
        ...new Set(
          programasIds
            .map((p) => parseInt(p, 10))
            .filter((p) => !isNaN(p))
        ),
      ];

      // Primero borramos las asociaciones actuales
      await client.query(
        "DELETE FROM estudiante_programas WHERE estudiante_id = $1",
        [studentId]
      );

      // Luego insertamos las nuevas (si hay)
      if (sanitizedProgramIds.length > 0) {
        const valuesClauses = sanitizedProgramIds
          .map((_, index) => `($1, $${index + 2})`)
          .join(", ");

        const programInsertValues = [studentId, ...sanitizedProgramIds];

        const programAssignQuery = `
          INSERT INTO estudiante_programas (estudiante_id, programa_id)
          VALUES ${valuesClauses};
        `;

        await client.query(programAssignQuery, programInsertValues);
      }
    }

    await client.query("COMMIT");

    return res
      .status(200)
      .json({ message: "Estudiante actualizado exitosamente." });
  } catch (err) {
    if (client) {
      await client.query("ROLLBACK");
    }
    console.error("Error en updateStudentController:", err);
    return handleServerError(
      res,
      err,
      "Error interno del servidor al actualizar el estudiante."
    );
  } finally {
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
  const { programaId } = req.params;
  if (!programaId || isNaN(programaId)) {
    return res.status(400).json({ error: "ID de programa inválido." });
  }

  try {
    const query = `
      SELECT
        s.*,
        COALESCE(
          json_agg(
            json_build_object(
              'programa_id', p.id,
              'nombre',      p.nombre,
              'tipo_programa', p.tipo_programa
            )
            ORDER BY p.nombre
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'::json
        ) AS programas_asociados
      FROM students s
      LEFT JOIN estudiante_programas ep ON s.id = ep.estudiante_id
      LEFT JOIN programas p ON ep.programa_id = p.id
      WHERE ep.programa_id = $1
      GROUP BY s.id
      ORDER BY s.nombre, s.apellido;
    `;
    const result = await pool.query(query, [programaId]);
    res.status(200).json(result.rows);
  } catch (err) {
    handleServerError(res, err, "Error obteniendo estudiantes por ID de programa.");
  }
};


// =======================================================
// LÓGICA DE OBTENCIÓN (READ) - Filtrado por Tipo de Programa (Ej. Bachillerato vs Técnicos)
// =======================================================
const getStudentsByProgramTypeController = async (req, res) => {
  const { tipo } = req.params;
  const { activo, modalidad } = req.query;

  // 1. Obtener datos del usuario desde el Token (inyectado por authMiddleware)
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId) {
    return res.status(401).json({ error: "Usuario no autenticado." });
  }

  if (tipo !== "bachillerato" && tipo !== "tecnicos") {
    return res
      .status(400)
      .json({ error: 'Tipo de programa inválido. Use "bachillerato" o "tecnicos".' });
  }

  const programTypeFilter = tipo === "bachillerato" ? "Validacion" : "Tecnico";

  try {
    // 2. Construcción dinámica de filtros (misma lógica que getStudentsController)
    const conditions = ["p.tipo_programa = $1"];
    const queryParams = [programTypeFilter];
    let paramIndex = 2;

    // LÓGICA DE SEGURIDAD:
    // Si NO es admin ni superadmin, filtramos obligatoriamente por su coordinador_id
    const isAdmin = userRole === 'admin' || userRole === 'superadmin';

    if (!isAdmin) {
      conditions.push(`s.coordinador_id = $${paramIndex}`);
      queryParams.push(userId);
      paramIndex++;
    }

    // Filtros opcionales de query params
    if (activo !== undefined && activo !== null) {
      conditions.push(`s.activo::TEXT = $${paramIndex}`);
      queryParams.push(activo);
      paramIndex++;
    }

    if (modalidad !== undefined && modalidad !== null) {
      conditions.push(`s.modalidad_estudio = $${paramIndex}`);
      queryParams.push(modalidad);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    console.log(`Consultando estudiantes por tipo. Usuario: ${userId}, Rol: ${userRole}, Tipo: ${tipo}`);

    const query = `
      SELECT
        s.*,
        COALESCE(
          json_agg(
            json_build_object(
              'programa_id',    p.id,
              'nombre',         p.nombre,
              'tipo_programa',  p.tipo_programa,
              'duracion_meses', p.duracion_meses
            )
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'::json
        ) AS programas_asociados
      FROM students s
      LEFT JOIN estudiante_programas ep ON s.id = ep.estudiante_id
      LEFT JOIN programas p ON ep.programa_id = p.id
      ${whereClause}
      GROUP BY s.id
      ORDER BY s.created_at DESC;
    `;

    const { rows } = await pool.query(query, queryParams);
    return res.status(200).json(rows);
  } catch (err) {
    console.error(`Error en getStudentsByProgramTypeController (${tipo}):`, err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};


// =======================================================
// LÓGICA DE GRADUACIÓN (PUT /students/:id/graduate)
// =======================================================
export const graduateStudentController = async (req, res) => {
  const studentId = parseInt(req.params.id, 10);
  if (!studentId || isNaN(studentId)) {
    return res.status(400).json({ error: 'ID de estudiante inválido.' });
  }

  try {
    const result = await pool.query(
      `UPDATE students
       SET fecha_graduacion = CURRENT_TIMESTAMP,
           activo           = false,
           updated_at       = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, nombre, apellido, fecha_graduacion`,
      [studentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado.' });
    }

    return res.status(200).json({
      message: 'Estudiante marcado como graduado exitosamente.',
      student: result.rows[0],
    });
  } catch (err) {
    console.error('Error al graduar estudiante:', err);
    return handleServerError(res, err, 'Error interno al graduar el estudiante.');
  }
};

export const updatePosibleGraduacionStudentController = async (req, res) => {
  const { id } = req.params;
  const { posible_graduacion } = req.body; // boolean

  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'ID de estudiante inválido.' });
  }

  if (typeof posible_graduacion !== 'boolean') {
    return res.status(400).json({ error: 'El campo posible_graduacion debe ser boolean (true/false).' });
  }

  try {
    const result = await pool.query(
      `
            UPDATE students
            SET posible_graduacion = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *;
            `,
      [posible_graduacion, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado.' });
    }

    res.status(200).json({
      message: 'Estado de posible graduación actualizado correctamente.',
      student: result.rows[0]
    });
  } catch (err) {
    handleServerError(res, err, 'Error actualizando estado de posible graduación del estudiante.');
  }
};

export const uploadStudentDocumentController = async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    return res
      .status(400)
      .json({ error: "ID de estudiante inválido o no proporcionado." });
  }

  if (!req.file) {
    return res.status(400).json({ error: "No se envió ningún archivo." });
  }

  try {
    const { buffer, originalname, mimetype } = req.file;

    const { publicUrl } = await uploadStudentDocumentToGCS(buffer, {
      filename: originalname,
      mimetype,
      studentId: id,
    });

    const updateQuery = `
      UPDATE students
      SET documento = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;

    const result = await pool.query(updateQuery, [publicUrl, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Estudiante no encontrado." });
    }

    const updatedStudent = result.rows[0];

    return res.status(200).json({
      message: "Documento subido y asociado al estudiante correctamente.",
      documento_url: publicUrl,
      student: updatedStudent,
    });
  } catch (err) {
    handleServerError(
      res,
      err,
      "Error interno del servidor al subir el documento del estudiante."
    );
  }
};

export const getStudentDocumentsController = async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    return res
      .status(400)
      .json({ error: "ID de estudiante inválido o no proporcionado." });
  }

  try {
    const query = `
      SELECT documento
      FROM students
      WHERE id = $1
    `;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Estudiante no encontrado." });
    }

    const docUrl = result.rows[0].documento;
    if (!docUrl) {
      return res.status(200).json([]); // sin documentos
    }

    const document = {
      id: id,
      url: docUrl,
      nombre: docUrl.split("/").pop(),
      mimetype: docUrl.endsWith(".pdf") ? "application/pdf" : "unknown",
    };

    return res.status(200).json([document]);
  } catch (err) {
    console.error("Error al obtener documentos:", err);
    return res
      .status(500)
      .json({ error: "Error interno del servidor al obtener documentos." });
  }
};


export const deleteStudentDocumentController = async (req, res) => {
  const { studentId } = req.params;

  if (!studentId || isNaN(studentId)) {
    return res
      .status(400)
      .json({ error: "ID de estudiante inválido o no proporcionado." });
  }

  try {
    // 1. Obtener el estudiante y su documento
    const selectQuery = `
      SELECT id, documento
      FROM students
      WHERE id = $1
    `;
    const result = await pool.query(selectQuery, [studentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Estudiante no encontrado." });
    }

    const student = result.rows[0];

    if (!student.documento) {
      // No tiene documento asociado
      return res
        .status(404)
        .json({ error: "El estudiante no tiene documento asociado." });
    }

    const fileUrl = student.documento;

    // 2. Eliminar de Google Cloud Storage
    try {
      await deleteStudentDocumentFromGCS(fileUrl);
    } catch (err) {
      console.error("[GCS] Error al eliminar el archivo:", err.message);
      // Podrías decidir si aquí haces return 500 o sigues y al menos limpias la BD
      return res.status(500).json({
        error:
          "Error al eliminar el archivo del almacenamiento. Inténtalo nuevamente.",
      });
    }

    // 3. Limpiar la columna documento en la tabla students
    const updateQuery = `
      UPDATE students
      SET documento = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    await pool.query(updateQuery, [studentId]);

    return res
      .status(200)
      .json({ message: "Documento eliminado correctamente." });
  } catch (err) {
    console.error("Error al eliminar documento:", err);
    return res.status(500).json({
      error: "Error interno del servidor al eliminar el documento.",
    });
  }
};







// ============================================================
// BULK: Mover lista de estudiantes a un programa
// POST /api/students/bulk-move-programa
// Body: { estudiante_ids: [1,2,3], programa_id: 5, replace: true|false }
//   replace=true  → reemplaza TODOS los programas del estudiante por el nuevo
//   replace=false → agrega el nuevo programa sin quitar los anteriores
// ============================================================
export const bulkMoveToPrograma = async (req, res) => {
  const { estudiante_ids, programa_id, replace = true } = req.body;
  const businessId = req.user?.bid;

  if (!Array.isArray(estudiante_ids) || estudiante_ids.length === 0) {
    return res.status(400).json({ error: 'Debes enviar al menos un estudiante_id.' });
  }
  if (!programa_id) {
    return res.status(400).json({ error: 'programa_id es requerido.' });
  }
  if (!businessId) {
    return res.status(403).json({ error: 'No se pudo determinar el negocio.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const id of estudiante_ids) {
      if (replace) {
        // Remove all current programs for this student (within business)
        await client.query(
          `DELETE FROM estudiante_programas
           WHERE estudiante_id = $1
             AND programa_id IN (
               SELECT id FROM programas WHERE business_id = $2
             )`,
          [id, businessId]
        );
      }
      // Insert new program (ignore if already exists)
      await client.query(
        `INSERT INTO estudiante_programas (estudiante_id, programa_id)
         VALUES ($1, $2)
         ON CONFLICT (estudiante_id, programa_id) DO NOTHING`,
        [id, programa_id]
      );
    }

    await client.query('COMMIT');
    return res.status(200).json({
      message: `${estudiante_ids.length} estudiante(s) movido(s) al programa correctamente.`,
      affected: estudiante_ids.length,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en bulkMoveToPrograma:', err);
    return res.status(500).json({ error: 'Error interno al mover estudiantes.' });
  } finally {
    client.release();
  }
};

export {
  deleteStudentController,
  updateEstadoStudentController,
  getStudentsByProgramaIdController,
  getStudentsByProgramTypeController,
  getStudentByDocumentController,
};
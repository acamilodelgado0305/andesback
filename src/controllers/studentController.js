import pool from '../database.js';




const createStudentController = async (req, res) => {
  // Desestructura los campos que vienen del frontend
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
    pagoMatricula, // 'Pagado' o 'Pendiente' (string)
    programasIds,
    coordinador, // Este campo es nuevo en la BD, asegúrate de que exista o quítalo
    modalidad_estudio,
    ultimoCursoAprobado,
  } = req.body;

  // Validaciones básicas
  if (!programasIds || !Array.isArray(programasIds) || programasIds.length === 0) {
    return res.status(400).json({ error: 'Debe seleccionar al menos un programa de interés (ID de inventario).' });
  }
  if (!nombre || !apellido || !email || !numeroDocumento) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para el estudiante (nombre, apellido, email, número de documento).' });
  }

  // --- CORRECCIÓN AQUÍ: Mapear 'pagoMatricula' a un valor booleano ---
  const estadoMatriculaBoolean = (pagoMatricula === 'Pagado'); // 'Pagado' -> true, 'Pendiente' -> false
  // ------------------------------------------------------------------

  let client; // Variable para la conexión del cliente para la transacción

  try {
    client = await pool.connect(); // Obtener un cliente del pool
    await client.query('BEGIN'); // Iniciar la transacción

    // 1. Insertar el nuevo estudiante en la tabla 'students'
    // Asegúrate de que todas estas columnas existan en tu tabla 'students'
    // He agregado 'coordinador' aquí. Si no lo vas a usar, elimínalo.
    const studentInsertQuery = `
      INSERT INTO students
        (nombre, apellido, email, tipo_documento, numero_documento, lugar_expedicion, fecha_nacimiento, lugar_nacimiento,
         telefono_llamadas, telefono_whatsapp, simat, estado_matricula, coordinador, modalidad_estudio,
         ultimo_curso_visto, fecha_inscripcion, activo)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP, true)
      RETURNING id`;

    const studentResult = await client.query(
      studentInsertQuery,
      [
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
        estadoMatriculaBoolean, // Usar el valor booleano mapeado
        coordinador, // Pasar el valor del coordinador aquí
        modalidad_estudio,
        ultimoCursoAprobado,
      ]
    );

    const newStudentId = studentResult.rows[0].id;

    // 2. Insertar las relaciones en la tabla intermedia 'estudiante_programas'
    // CORRECCIÓN: Usar el nombre de tabla y columnas correctos
    for (const programaId of programasIds) { // Cambié 'inventarioId' a 'programaId' para mayor claridad
      if (isNaN(parseInt(programaId, 10))) {
        throw new Error(`ID de programa inválido proporcionado: ${programaId}`);
      }

      const programAssignQuery = `
        INSERT INTO estudiante_programas (estudiante_id, programa_id)
        VALUES ($1, $2)
      `;
      await client.query(programAssignQuery, [newStudentId, parseInt(programaId, 10)]);
    }

    await client.query('COMMIT');
    res.status(201).json({ message: "Estudiante y programas asociados creados exitosamente", studentId: newStudentId });

  } catch (err) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Error creando estudiante o asociando programas:', err);
    res.status(500).json({
      error: 'Error al crear el estudiante o asociar los programas.',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    if (client) {
      client.release();
    }
  }
};

const getStudentsController = async (req, res) => {
  try {
    // Consulta SQL para obtener todos los estudiantes
    // y los nombres de los programas asociados a cada uno,
    // agrupados en un array.
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
          s.coordinador, -- Asegúrate de que esta columna exista en 'students'
          s.modalidad_estudio,
          s.ultimo_curso_visto,
          s.fecha_inscripcion,
          s.activo,
          s.created_at,
          s.updated_at,
          s.fecha_graduacion,
          s.matricula,
          -- Agregamos los programas asociados como un array de objetos JSON
          COALESCE(
              json_agg(
                  json_build_object(
                      'programa_id', i.id,
                      'nombre_programa', i.nombre,
                      'monto_programa', i.monto -- Puedes incluir más campos de inventario si los necesitas
                  )
                  ORDER BY i.nombre -- Opcional: ordenar los programas por nombre
              ) FILTER (WHERE i.id IS NOT NULL), -- Importante para no incluir nulls si no hay programas
              '[]'::json -- Si no hay programas, devuelve un array vacío en lugar de null
          ) AS programas_asociados
      FROM
          students s
      LEFT JOIN
          estudiante_programas ep ON s.id = ep.estudiante_id
      LEFT JOIN
          inventario i ON ep.programa_id = i.id
      GROUP BY
          s.id -- Agrupar por el ID del estudiante para que ARRAY_AGG funcione correctamente
      ORDER BY
          s.nombre, s.apellido; -- Opcional: ordenar los resultados principales
    `;

    const result = await pool.query(query);

    res.status(200).json(result.rows);

  } catch (err) {
    console.error('Error obteniendo estudiantes y programas asociados:', err);
    res.status(500).json({
      error: 'Error obteniendo estudiantes y sus programas asociados.',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};



// Asegúrate de tener tu configuración de pool de PostgreSQL importada
// const pool = require('../config/db'); // Ejemplo de importación

const getStudentByIdController = async (req, res) => {
  const { id } = req.params;
  try {
    // Consulta SQL para obtener un estudiante específico
    // y sus programas asociados agrupados en un array JSON.
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
          s.coordinador,
          s.modalidad_estudio,
          s.ultimo_curso_visto,
          s.fecha_inscripcion,
          s.activo,
          s.created_at,
          s.updated_at,
          s.fecha_graduacion,
          s.matricula,
          -- Agregamos los programas asociados como un array de objetos JSON
          COALESCE(
              json_agg(
                  json_build_object(
                      'programa_id', i.id,
                      'nombre_programa', i.nombre,
                      'monto_programa', i.monto -- Puedes incluir más campos de inventario si los necesitas
                  )
                  ORDER BY i.nombre
              ) FILTER (WHERE i.id IS NOT NULL), -- Importante para no incluir nulls si no hay programas
              '[]'::json -- Si no hay programas, devuelve un array vacío en lugar de null
          ) AS programas_asociados
      FROM
          students s
      LEFT JOIN
          estudiante_programas ep ON s.id = ep.estudiante_id
      LEFT JOIN
          inventario i ON ep.programa_id = i.id
      WHERE
          s.id = $1 -- Aquí filtramos por el ID del estudiante
      GROUP BY
          s.id; -- Agrupar por el ID del estudiante es esencial para json_agg
    `;

    const result = await pool.query(query, [id]); // Pasamos el ID como parámetro de la consulta

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    // Como esperamos solo un estudiante por ID, devolvemos el primer (y único) resultado.
    res.status(200).json(result.rows[0]);

  } catch (err) {
    console.error('Error obteniendo estudiante por ID y sus programas asociados:', err);
    res.status(500).json({
      error: 'Error obteniendo estudiante por ID',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined // Solo detalles en desarrollo
    });
  }
};




const updateStudentController = async (req, res) => {
  const { id } = req.params;
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
    eps,
    rh,
    nombreAcudiente,
    tipoDocumentoAcudiente,
    telefonoAcudiente,
    direccionAcudiente,
    simat,
    estadoMatricula,
    programa_nombre,
    coordinador,
    activo,
    modalidad_estudio,
    ultimo_curso_visto,
    matricula
  } = req.body;

  // Validación del ID
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'ID de estudiante inválido' });
  }

  if (!nombre || !apellido || !email || !tipoDocumento || !numeroDocumento) {
    return res.status(400).json({
      error: 'Los campos nombre, apellido, email, tipo de documento y número de documento son obligatorios'
    });
  }

  // Validación básica de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Formato de email inválido' });
  }

  try {
    // Verificar si el estudiante existe
    const existingStudent = await pool.query('SELECT * FROM students WHERE id = $1', [id]);

    if (existingStudent.rows.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }


    // Actualizar el estudiante en la base de datos
    const result = await pool.query(
      `UPDATE students 
       SET nombre = $1, 
           apellido = $2, 
           email = $3, 
           tipo_documento = $4, 
           numero_documento = $5, 
           lugar_expedicion = $6, 
           fecha_nacimiento = $7, 
           lugar_nacimiento = $8, 
           telefono_llamadas = $9, 
           telefono_whatsapp = $10, 
           eps = $11, 
           rh = $12, 
           nombre_acudiente = $13, 
           tipo_documento_acudiente = $14, 
           telefono_acudiente = $15, 
           direccion_acudiente = $16, 
           simat = $17, 
           estado_matricula = $18, 
           programa_nombre = $19,
           coordinador = $20,
           activo = $21,
           modalidad_estudio = $22, 
           ultimo_curso_visto = $23, 
           matricula = $24,  -- 🔥 Se actualiza el valor dinámico de matrícula
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $25 
       RETURNING *`,
      [
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
        eps,
        rh,
        nombreAcudiente,
        tipoDocumentoAcudiente,
        telefonoAcudiente,
        direccionAcudiente,
        simat,
        estadoMatricula,
        programa_nombre,
        coordinador,
        activo,
        modalidad_estudio,
        ultimo_curso_visto,
        matricula, 
        id
      ]
    );

    res.status(200).json({
      mensaje: 'Estudiante actualizado exitosamente',
      estudiante: result.rows[0]
    });
  } catch (err) {
    console.error('Error actualizando estudiante:', err);
    res.status(500).json({
      error: 'Error interno del servidor al actualizar el estudiante',
      detalles: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

const deleteStudentController = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM students WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error eliminando estudiante', err);
    res.status(500).json({ error: 'Error eliminando estudiante' });
  }
};

const updateEstadoStudentController = async (req, res) => {
  const { id } = req.params;
  const { estado_matricula } = req.body;
  try {
    const result = await pool.query(
      `UPDATE students 
       SET estado_matricula = $1
       WHERE id = $2 
       RETURNING *`,
      [estado_matricula, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error actualizando estado de estudiante', err);
    res.status(500).json({ error: 'Error actualizando estado de estudiante' });
  }
};

const getStudentsByBachilleratoController = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM students WHERE programa_nombre = $1',
      ['Validación de bachillerato']
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error obteniendo estudiantes de Validación de Bachillerato', err);
    res.status(500).json({ error: 'Error obteniendo estudiantes de Validación de Bachillerato' });
  }
};

const getStudentsByTecnicosController = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM students WHERE programa_nombre != $1',
      ['Validación de bachillerato']
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error obteniendo estudiantes de Cursos Técnicos', err);
    res.status(500).json({ error: 'Error obteniendo estudiantes de Cursos Técnicos' });
  }
};

export {
  createStudentController,
  getStudentsController,
  getStudentByIdController,
  updateStudentController,
  deleteStudentController,
  updateEstadoStudentController,
  getStudentsByBachilleratoController,
  getStudentsByTecnicosController // Agregar el nuevo controlador a las exportaciones
};



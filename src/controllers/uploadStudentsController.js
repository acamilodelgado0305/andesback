import pool from '../database.js';
import xlsx from 'xlsx';
import fs from 'fs';

const uploadStudentsController = async (req, res) => {
    const file = req.file;
    const { coordinador } = req.body; // Agregar el coordinador desde el cuerpo de la solicitud

    if (!file) {
        return res.status(400).json({ error: 'Archivo no proporcionado' });
    }

    if (!coordinador) {
        return res.status(400).json({ error: 'Coordinador no proporcionado' });
    }

    try {
        // Leer el archivo Excel
        const workbook = xlsx.readFile(file.path);
        const sheetName = workbook.SheetNames[0];
        const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        // Mapear los datos a los campos de la tabla
        const students = sheetData.map(row => ({
            nombre: row['Nombre'] || null,
            apellido: row['Apellido'] || null,
            email: row['Email'] || null,
            tipoDocumento: row['Tipo Documento'] || null,
            numeroDocumento: row['Número Documento'] || null,
            lugarExpedicion: row['Lugar Expedición'] || null,
            fechaNacimiento: row['Fecha Nacimiento'] || null,
            lugarNacimiento: row['Lugar Nacimiento'] || null,
            telefonoLlamadas: row['Teléfono Llamadas'] || null,
            telefonoWhatsapp: row['Teléfono Whatsapp'] || null,
            eps: row['EPS'] || null,
            rh: row['RH'] || null,
            nombreAcudiente: row['Nombre Acudiente'] || null,
            tipoDocumentoAcudiente: row['Tipo Documento Acudiente'] || null,
            telefonoAcudiente: row['Teléfono Acudiente'] || null,
            direccionAcudiente: row['Dirección Acudiente'] || null,
            simat: row['SIMAT'] || null,
            estadoMatricula: row['Estado Matrícula'] === 'true',
            programa_id: row['Programa ID'] || null
        }));

        // Validar que todos los estudiantes tengan programa_id
        for (const student of students) {
            if (!student.programa_id) {
                return res.status(400).json({ error: 'Falta programa_id para uno o más estudiantes.' });
            }
        }

        // Insertar los datos en la tabla
        const query = `
            INSERT INTO students 
            (nombre, apellido, email, tipo_documento, numero_documento, lugar_expedicion, fecha_nacimiento, lugar_nacimiento,
            telefono_llamadas, telefono_whatsapp, eps, rh, nombre_acudiente, tipo_documento_acudiente,
            telefono_acudiente, direccion_acudiente, simat, estado_matricula, programa_id, coordinador, fecha_inscripcion, activo)
            VALUES 
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, CURRENT_TIMESTAMP, true)
        `;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (const student of students) {
                await client.query(query, [
                    student.nombre,
                    student.apellido,
                    student.email,
                    student.tipoDocumento,
                    student.numeroDocumento,
                    student.lugarExpedicion,
                    student.fechaNacimiento,
                    student.lugarNacimiento,
                    student.telefonoLlamadas,
                    student.telefonoWhatsapp,
                    student.eps,
                    student.rh,
                    student.nombreAcudiente,
                    student.tipoDocumentoAcudiente,
                    student.telefonoAcudiente,
                    student.direccionAcudiente,
                    student.simat,
                    student.estadoMatricula,
                    student.programa_id,
                    coordinador
                ]);
            }
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        // Eliminar el archivo temporal
        fs.unlinkSync(file.path);

        res.status(201).json({ message: 'Estudiantes cargados exitosamente' });
    } catch (err) {
        console.error('Error procesando archivo Excel', err);
        res.status(500).json({ error: 'Error procesando archivo Excel' });
    }
};


export { uploadStudentsController };

import { Storage } from '@google-cloud/storage';
import path from 'path';
import { fileURLToPath } from 'url';

// Importamos el MODELO que acabamos de crear
import { Business } from '../models/Business.js';


const storage = new Storage();
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);


const uploadBusinessProfilePicture = async (req, res) => {
    try {
        const { businessId } = req.params;
        if (!req.file) {
            return res.status(400).json({ error: 'No se subió ningún archivo.' });
        }

        const business = await Business.findByPk(businessId);
        if (!business) {
            return res.status(404).json({ error: 'El negocio no fue encontrado.' });
        }

        const blob = bucket.file(`profile-pictures/${businessId}-${Date.now()}-${req.file.originalname}`);
        const blobStream = blob.createWriteStream({ resumable: false });

        // SOLUCIÓN: Usamos una Promesa para manejar la subida de forma segura y evitar errores.
        await new Promise((resolve, reject) => {
            blobStream.on('error', (err) => {
                console.error('Error en el stream de subida:', err);
                reject(err); // Si hay error, la promesa falla
            });

            blobStream.on('finish', () => {
                resolve(); // Si la subida termina, la promesa se completa con éxito
            });

            // CORRECCIÓN: Llamamos a .end() UNA SOLA VEZ para iniciar la subida.
            blobStream.end(req.file.buffer);
        });

        // Este código solo se ejecuta si la promesa se resolvió (subida exitosa)
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
        
        await business.update({ profilePictureUrl: publicUrl });

        return res.status(200).json({
            message: 'Foto de perfil actualizada con éxito.',
            businessId: business.id,
            url: publicUrl,
        });

    } catch (err) {
        // Este bloque CATCH ahora captura cualquier error de forma segura.
        console.error('Error en uploadBusinessProfilePicture:', err);
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'Error interno del servidor.',
                details: err.message
            });
        }
    }
};

export { uploadBusinessProfilePicture };
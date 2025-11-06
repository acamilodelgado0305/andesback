// src/services/gcsStudentDocuments.js
import { Storage } from "@google-cloud/storage";
import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const storage = new Storage(); // usa GOOGLE_APPLICATION_CREDENTIALS por env
const studentsBucketName = process.env.GCS_STUDENTS_BUCKET_NAME;

if (!studentsBucketName) {
  console.warn("[GCS] WARNING: GCS_STUDENTS_BUCKET_NAME no está definido en .env");
}

const studentsBucket = storage.bucket(studentsBucketName);

/**
 * 📤 Sube un archivo de documento de estudiante a GCS (compatible con UBLA)
 */
export const uploadStudentDocumentToGCS = async (
  fileBuffer,
  { filename, mimetype, studentId }
) => {
  if (!studentsBucketName) {
    throw new Error("GCS_STUDENTS_BUCKET_NAME no está configurado");
  }

  const ext = path.extname(filename) || ".pdf";
  const safeName = path.basename(filename, ext).replace(/[^\w\d-_]/g, "_");
  const randomSlug = crypto.randomBytes(6).toString("hex");

  const gcsFileName = `students/${studentId}/${Date.now()}-${safeName}-${randomSlug}${ext}`;
  const file = studentsBucket.file(gcsFileName);

  // ✅ No uses ACLs (ni `public: true`)
  await file.save(fileBuffer, {
    contentType: mimetype,
    resumable: false,
    metadata: {
      cacheControl: "public, max-age=31536000",
    },
  });

  // ⚠️ En UBLA no puedes modificar ACL, así que no uses makePublic()
  // Si tu bucket es público, las URLs serán accesibles directamente
  const publicUrl = `https://storage.googleapis.com/${studentsBucketName}/${gcsFileName}`;

  return { publicUrl, gcsPath: gcsFileName };
};

/**
 * 🗑️ Elimina un archivo de estudiante de GCS.
 * @param {string} fileUrlOrPath - Puede ser la URL pública completa o la ruta dentro del bucket (gcsPath)
 * @returns {Promise<boolean>} true si se eliminó o ya no existía
 */
export const deleteStudentDocumentFromGCS = async (fileUrlOrPath) => {
  if (!studentsBucketName) {
    throw new Error("GCS_STUDENTS_BUCKET_NAME no está configurado");
  }

  try {
    // Si viene la URL completa, extraemos el path dentro del bucket
    const gcsPath = fileUrlOrPath.includes("storage.googleapis.com")
      ? fileUrlOrPath.split(".com/")[1]
      : fileUrlOrPath;

    if (!gcsPath) {
      console.warn("[GCS] No se encontró ruta válida para eliminar.");
      return false;
    }

    const file = studentsBucket.file(gcsPath);
    await file.delete();

    console.log(`[GCS] Archivo eliminado correctamente: ${gcsPath}`);
    return true;
  } catch (error) {
    if (error.code === 404) {
      console.warn("[GCS] Archivo no encontrado, posiblemente ya eliminado.");
      return true; // se considera éxito
    }
    console.error("[GCS] Error al eliminar archivo:", error.message);
    throw error;
  }
};

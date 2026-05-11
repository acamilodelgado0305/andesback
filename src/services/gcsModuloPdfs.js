// src/services/gcsModuloPdfs.js
import { Storage } from "@google-cloud/storage";
import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const storage = new Storage();
const bucketName = process.env.GCS_STUDENTS_BUCKET_NAME;

if (!bucketName) {
  console.warn("[GCS] WARNING: GCS_STUDENTS_BUCKET_NAME no está definido en .env");
}

const bucket = storage.bucket(bucketName);

/**
 * 📤 Sube un PDF de módulo a GCS
 * @returns {{ publicUrl, gcsPath }}
 */
export const uploadModuloPdfToGCS = async (fileBuffer, { filename, mimetype, moduloId }) => {
  if (!bucketName) throw new Error("GCS_STUDENTS_BUCKET_NAME no está configurado");

  const ext = path.extname(filename) || ".pdf";
  const safeName = path.basename(filename, ext).replace(/[^\w\d-_]/g, "_");
  const randomSlug = crypto.randomBytes(6).toString("hex");

  const gcsPath = `modulos/${moduloId}/${Date.now()}-${safeName}-${randomSlug}${ext}`;
  const file = bucket.file(gcsPath);

  await file.save(fileBuffer, {
    contentType: mimetype,
    resumable: false,
    metadata: { cacheControl: "public, max-age=31536000" },
  });

  const publicUrl = `https://storage.googleapis.com/${bucketName}/${gcsPath}`;
  return { publicUrl, gcsPath };
};

/**
 * 🗑️ Elimina un PDF de módulo de GCS usando su gcsPath
 */
export const deleteModuloPdfFromGCS = async (gcsPath) => {
  if (!bucketName) throw new Error("GCS_STUDENTS_BUCKET_NAME no está configurado");

  // Si llega una URL completa, extraer solo el path interno
  const cleanPath = gcsPath.includes("storage.googleapis.com")
    ? gcsPath.split(`${bucketName}/`)[1]
    : gcsPath;

  if (!cleanPath) return false;

  try {
    await bucket.file(cleanPath).delete();
    console.log(`[GCS] PDF de módulo eliminado: ${cleanPath}`);
    return true;
  } catch (error) {
    if (error.code === 404) return true; // ya no existía, ok
    throw error;
  }
};

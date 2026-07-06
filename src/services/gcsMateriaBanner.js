// src/services/gcsMateriaBanner.js
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
 * 📤 Sube el banner (foto de portada) de una materia a GCS
 * @returns {{ publicUrl, gcsPath }}
 */
export const uploadMateriaBannerToGCS = async (fileBuffer, { filename, mimetype, materiaId }) => {
  if (!bucketName) throw new Error("GCS_STUDENTS_BUCKET_NAME no está configurado");

  const ext = path.extname(filename) || ".jpg";
  const randomSlug = crypto.randomBytes(6).toString("hex");

  const gcsPath = `materias/${materiaId}/banner-${Date.now()}-${randomSlug}${ext}`;
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
 * 🗑️ Elimina el banner anterior de una materia de GCS usando su gcsPath
 */
export const deleteMateriaBannerFromGCS = async (gcsPath) => {
  if (!bucketName) throw new Error("GCS_STUDENTS_BUCKET_NAME no está configurado");

  const cleanPath = gcsPath.includes("storage.googleapis.com")
    ? gcsPath.split(`${bucketName}/`)[1]
    : gcsPath;

  if (!cleanPath) return false;

  try {
    await bucket.file(cleanPath).delete();
    return true;
  } catch (error) {
    if (error.code === 404) return true;
    throw error;
  }
};

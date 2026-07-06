// src/services/gcsClases.js
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

const uploadTo = async (fileBuffer, { filename, mimetype, gcsPath }) => {
  if (!bucketName) throw new Error("GCS_STUDENTS_BUCKET_NAME no está configurado");
  const file = bucket.file(gcsPath);
  await file.save(fileBuffer, {
    contentType: mimetype,
    resumable: false,
    metadata: { cacheControl: "public, max-age=31536000" },
  });
  return `https://storage.googleapis.com/${bucketName}/${gcsPath}`;
};

const deleteFrom = async (gcsPath) => {
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

/** 📤 Sube la grabación (video) de una clase a GCS */
export const uploadClaseVideoToGCS = async (fileBuffer, { filename, mimetype, claseId }) => {
  const ext = path.extname(filename) || ".mp4";
  const randomSlug = crypto.randomBytes(6).toString("hex");
  const gcsPath = `clases/${claseId}/video-${Date.now()}-${randomSlug}${ext}`;
  const publicUrl = await uploadTo(fileBuffer, { filename, mimetype, gcsPath });
  return { publicUrl, gcsPath };
};

export const deleteClaseVideoFromGCS = (gcsPath) => deleteFrom(gcsPath);

/** 📤 Sube un PDF adjunto a una clase a GCS */
export const uploadClasePdfToGCS = async (fileBuffer, { filename, mimetype, claseId }) => {
  const ext = path.extname(filename) || ".pdf";
  const safeName = path.basename(filename, ext).replace(/[^\w\d-_]/g, "_");
  const randomSlug = crypto.randomBytes(6).toString("hex");
  const gcsPath = `clases/${claseId}/pdfs/${Date.now()}-${safeName}-${randomSlug}${ext}`;
  const publicUrl = await uploadTo(fileBuffer, { filename, mimetype, gcsPath });
  return { publicUrl, gcsPath };
};

export const deleteClasePdfFromGCS = (gcsPath) => deleteFrom(gcsPath);

/** 📤 Sube una presentación (PDF/PPTX/SVG) de una clase a GCS */
export const uploadClasePresentacionToGCS = async (fileBuffer, { filename, mimetype, claseId }) => {
  const ext = path.extname(filename) || "";
  const safeName = path.basename(filename, ext).replace(/[^\w\d-_]/g, "_");
  const randomSlug = crypto.randomBytes(6).toString("hex");
  const gcsPath = `clases/${claseId}/presentaciones/${Date.now()}-${safeName}-${randomSlug}${ext}`;
  const publicUrl = await uploadTo(fileBuffer, { filename, mimetype, gcsPath });
  return { publicUrl, gcsPath };
};

export const deleteClasePresentacionFromGCS = (gcsPath) => deleteFrom(gcsPath);

/**
 * Devuelve el handle del archivo en GCS para poder hacer streaming desde el
 * backend (proxy same-origin). Necesario para que pdf.js pueda descargar el PDF
 * sin toparse con CORS (el bucket no expone cabeceras CORS).
 */
export const getClasePresentacionFile = (gcsPath) => {
  if (!bucketName) throw new Error("GCS_STUDENTS_BUCKET_NAME no está configurado");
  const cleanPath = gcsPath.includes("storage.googleapis.com")
    ? gcsPath.split(`${bucketName}/`)[1]
    : gcsPath;
  return bucket.file(cleanPath);
};

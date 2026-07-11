// src/services/gcsCopy.js
// Copia server-side de objetos dentro del mismo bucket de GCS. Se usa al duplicar
// una materia en otro programa: cada archivo (banner, video, PDF, presentación) se
// copia a un path nuevo ligado a los ids nuevos, de modo que la materia copiada es
// 100% independiente (borrar la original no afecta la copia).
//
// `bucket.file(src).copy(bucket.file(dest))` es una operación server-side de GCS:
// no descarga ni re-sube el archivo por nuestro backend, así que es rápida incluso
// para videos grandes.
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

// Acepta una URL pública completa o un path interno y devuelve el path interno.
const cleanPath = (srcUrlOrPath) => {
  if (!srcUrlOrPath) return null;
  return srcUrlOrPath.includes("storage.googleapis.com")
    ? srcUrlOrPath.split(`${bucketName}/`)[1]
    : srcUrlOrPath;
};

const randomSlug = () => crypto.randomBytes(6).toString("hex");
const safeBase = (filename, ext) =>
  path.basename(filename || "archivo", ext).replace(/[^\w\d-_]/g, "_");

// Copia el objeto `src` (URL o path) al `destPath` dado. Devuelve
// { publicUrl, gcsPath } o null si no había origen.
const copyTo = async (srcUrlOrPath, destPath) => {
  if (!bucketName) throw new Error("GCS_STUDENTS_BUCKET_NAME no está configurado");
  const src = cleanPath(srcUrlOrPath);
  if (!src) return null;
  await bucket.file(src).copy(bucket.file(destPath));
  return { publicUrl: `https://storage.googleapis.com/${bucketName}/${destPath}`, gcsPath: destPath };
};

/** 📄 Copia el banner de una materia → materias/{materiaId}/banner-... */
export const copyMateriaBanner = (srcUrlOrPath, materiaId, originalName) => {
  const ext = path.extname(originalName || "") || ".jpg";
  return copyTo(srcUrlOrPath, `materias/${materiaId}/banner-${Date.now()}-${randomSlug()}${ext}`);
};

/** 📄 Copia un PDF a nivel tema → modulos/{moduloId}/... */
export const copyModuloPdf = (srcUrlOrPath, moduloId, originalName) => {
  const ext = path.extname(originalName || "") || ".pdf";
  const safe = safeBase(originalName, ext);
  return copyTo(srcUrlOrPath, `modulos/${moduloId}/${Date.now()}-${safe}-${randomSlug()}${ext}`);
};

/** 🎬 Copia la grabación (video) de una clase → clases/{claseId}/video-... */
export const copyClaseVideo = (srcUrlOrPath, claseId, originalName) => {
  const ext = path.extname(originalName || "") || ".mp4";
  return copyTo(srcUrlOrPath, `clases/${claseId}/video-${Date.now()}-${randomSlug()}${ext}`);
};

/** 📄 Copia un PDF adjunto a una clase → clases/{claseId}/pdfs/... */
export const copyClasePdf = (srcUrlOrPath, claseId, originalName) => {
  const ext = path.extname(originalName || "") || ".pdf";
  const safe = safeBase(originalName, ext);
  return copyTo(srcUrlOrPath, `clases/${claseId}/pdfs/${Date.now()}-${safe}-${randomSlug()}${ext}`);
};

/** 📽️ Copia una presentación (PDF/PPTX/SVG) de una clase → clases/{claseId}/presentaciones/... */
export const copyClasePresentacion = (srcUrlOrPath, claseId, originalName) => {
  const ext = path.extname(originalName || "") || "";
  const safe = safeBase(originalName, ext);
  return copyTo(srcUrlOrPath, `clases/${claseId}/presentaciones/${Date.now()}-${safe}-${randomSlug()}${ext}`);
};

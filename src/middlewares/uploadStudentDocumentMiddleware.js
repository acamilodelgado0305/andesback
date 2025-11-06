// src/middlewares/uploadStudentDocumentMiddleware.js
import multer from "multer";

const storage = multer.memoryStorage();

const pdfFileFilter = (req, file, cb) => {
  if (file.mimetype !== "application/pdf") {
    return cb(new Error("Solo se permiten archivos PDF."), false);
  }
  cb(null, true);
};

const uploadStudentDocument = multer({
  storage,
  fileFilter: pdfFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

export default uploadStudentDocument;

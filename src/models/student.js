import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const studentSchema = new mongoose.Schema(
  {
    id: { type: String, default: uuidv4, unique: true },
    nombre: { type: String, required: true },
    apellido: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    telefono: String,
    fechaNacimiento: Date,
    programa: {
      type: String,
      enum: ["CarreraTecnica", "ValidacionBachillerato"],
      required: true,
    },
    coordinador: { type: String, required: true },
    fechaInscripcion: { type: Date, default: Date.now },
    activo: { type: Boolean, default: true },
    ultimoCursoVisto: { type: Number },
    numeroCedula: { type: String, unique: true },
    modalidadEstudio: {
      type: String,
      enum: ["Presencial", "Virtual", "Mixto"],
      required: true,
    },
    facturas: [{ type: mongoose.Schema.Types.ObjectId, ref: "Invoice" }]
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Student", studentSchema);

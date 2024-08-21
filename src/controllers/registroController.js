import {
  createUserReg,
  getUsersReg,
  getUserReg,
  updateUserReg,
  deleteUserReg,
} from "../models/registroModel.js";

const createUserRegController = async (req, res) => {
  const {
    nombre,
    apellido,
    email,
    telefono,
    fechaNacimiento,
    programaId,
    coordinador,
    ultimoCursoVisto,
    numeroCedula,
    modalidadEstudio,
  } = req.body;
  try {
    const student = await createUserReg(
      nombre,
      apellido,
      email,
      telefono,
      fechaNacimiento,
      programaId,
      coordinador,
      ultimoCursoVisto,
      numeroCedula,
      modalidadEstudio
    );
    res.status(201).json(student);
  } catch (err) {
    console.error("Error creando estudiante", err);
    res.status(500).json({ error: "Error creando estudiante" });
  }
};

const getUsersRegController = async (req, res) => {
  try {
    const students = await getUsersReg();
    res.status(200).json(students);
  } catch (err) {
    console.error("Error obteniendo estudiantes", err);
    res.status(500).json({ error: "Error obteniendo estudiantes" });
  }
};

const getUserRegByIdController = async (req, res) => {
  const { id } = req.params;
  try {
    const student = await getUserReg(id);
    if (!student) {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }
    res.status(200).json(student);
  } catch (err) {
    console.error("Error obteniendo estudiante", err);
    res.status(500).json({ error: "Error obteniendo estudiante" });
  }
};

const updateUserRegController = async (req, res) => {
  const { id } = req.params;
  const {
    nombre,
    apellido,
    email,
    telefono,
    fechaNacimiento,
    programaId,
    coordinador,
    ultimoCursoVisto,
    numeroCedula,
    modalidadEstudio,
    activo,
  } = req.body;
  try {
    const student = await updateUserReg(
      id,
      nombre,
      apellido,
      email,
      telefono,
      fechaNacimiento,
      programaId,
      coordinador,
      ultimoCursoVisto,
      numeroCedula,
      modalidadEstudio,
      activo
    );
    if (!student) {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }
    res.status(200).json(student);
  } catch (err) {
    console.error("Error actualizando estudiante", err);
    res.status(500).json({ error: "Error actualizando estudiante" });
  }
};

const deleteUserRegController = async (req, res) => {
  const { id } = req.params;
  try {
    const student = await deleteUserReg(id);
    if (!student) {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }
    res.status(200).json(student);
  } catch (err) {
    console.error("Error eliminando estudiante", err);
    res.status(500).json({ error: "Error eliminando estudiante" });
  }
};

export {
  createUserRegController,
  getUsersRegController,
  getUserRegByIdController,
  updateUserRegController,
  deleteUserRegController,
};

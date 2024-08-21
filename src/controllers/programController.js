// controllers/programController.js
import {
  createProgram,
  getPrograms,
  getProgramById,
  updateProgram,
  deleteProgram
} from '../models/programModel.js';

const createProgramController = async (req, res) => {
  const { nombre, valor } = req.body;
  try {
    const program = await createProgram(nombre, valor);
    res.status(201).json(program);
  } catch (err) {
    console.error('Error creando programa', err);
    res.status(500).json({ error: 'Error creando programa' });
  }
};

const getProgramsController = async (req, res) => {
  try {
    const programs = await getPrograms();
    res.status(200).json(programs);
  } catch (err) {
    console.error('Error obteniendo programas', err);
    res.status(500).json({ error: 'Error obteniendo programas' });
  }
};

const getProgramByIdController = async (req, res) => {
  const { id } = req.params;
  try {
    const program = await getProgramById(id);
    if (!program) {
      return res.status(404).json({ error: 'Programa no encontrado' });
    }
    res.status(200).json(program);
  } catch (err) {
    console.error('Error obteniendo programa', err);
    res.status(500).json({ error: 'Error obteniendo programa' });
  }
};

const updateProgramController = async (req, res) => {
  const { id } = req.params;
  const { nombre, valor } = req.body;
  try {
    const program = await updateProgram(id, nombre, valor);
    if (!program) {
      return res.status(404).json({ error: 'Programa no encontrado' });
    }
    res.status(200).json(program);
  } catch (err) {
    console.error('Error actualizando programa', err);
    res.status(500).json({ error: 'Error actualizando programa' });
  }
};

const deleteProgramController = async (req, res) => {
  const { id } = req.params;
  try {
    const program = await deleteProgram(id);
    if (!program) {
      return res.status(404).json({ error: 'Programa no encontrado' });
    }
    res.status(200).json(program);
  } catch (err) {
    console.error('Error eliminando programa', err);
    res.status(500).json({ error: 'Error eliminando programa' });
  }
};

export {
  createProgramController,
  getProgramsController,
  getProgramByIdController,
  updateProgramController,
  deleteProgramController
};

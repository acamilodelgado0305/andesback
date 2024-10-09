// controllers/subjectController.js
import {
    createSubject,
    getSubjects,
    getSubjectById,
    updateSubject,
    deleteSubject
  } from '../models/subjectModel.js';
  
  const createSubjectController = async (req, res) => {
    const { nombre, codigo,  descripcion, program_id} = req.body;
    try {
      const subject = await createSubject(nombre, codigo,  descripcion, program_id);
      res.status(201).json(subject);
    } catch (err) {
      console.error('Error creando materia', err);
      res.status(500).json({ error: 'Error creando materia' });
    }
  };
  
  const getSubjectsController = async (req, res) => {
    try {
      const subjects = await getSubjects();
      res.status(200).json(subjects);
    } catch (err) {
      console.error('Error obteniendo materias', err);
      res.status(500).json({ error: 'Error obteniendo materias' });
    }
  };
  
  const getSubjectByIdController = async (req, res) => {
    const { id } = req.params;
    try {
      const subject = await getSubjectById(id);
      if (!subject) {
        return res.status(404).json({ error: 'Materia no encontrada' });
      }
      res.status(200).json(subject);
    } catch (err) {
      console.error('Error obteniendo materia', err);
      res.status(500).json({ error: 'Error obteniendo materia' });
    }
  };
  
  const updateSubjectController = async (req, res) => {
    const { id } = req.params;
    const { nombre, codigo,  descripcion, program_id} = req.body;
    try {
      const subject = await updateSubject(id, nombre, codigo,  descripcion, program_id);
      if (!subject) {
        return res.status(404).json({ error: 'Materia no encontrada' });
      }
      res.status(200).json(subject);
    } catch (err) {
      console.error('Error actualizando materia', err);
      res.status(500).json({ error: 'Error actualizando materia' });
    }
  };
  
  const deleteSubjectController = async (req, res) => {
    const { id } = req.params;
    try {
      const subject = await deleteSubject(id);
      if (!subject) {
        return res.status(404).json({ error: 'Materia no encontrada' });
      }
      res.status(200).json(subject);
    } catch (err) {
      console.error('Error eliminando materia', err);
      res.status(500).json({ error: 'Error eliminando materia' });
    }
  };
  
  export {
    createSubjectController,
    getSubjectsController,
    getSubjectByIdController,
    updateSubjectController,
    deleteSubjectController
  };
  

import { Router } from "express";

//almacenamos Router en router
const router = Router();

//importamos los metodos desde controllers

import {
  createStudent,
  getStudentById,
  getStudents,
} from "../controllers/student.controller.js";

// asociar o enrutar a cada direccon si esta vacia o esta identificada
router.route("/").post(createStudent).get(getStudents);

router.route("/:id").get(getStudentById);

export default router;

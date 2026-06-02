import 'dotenv/config'; // Carga .env ANTES de cualquier otro import (se ejecuta al importarse)

import app from './app.js';
import './database.js';
import { verificarConexionCorreo } from './services/mailService.js';

const PORT = process.env.PORT || 8080;  // 👈 Cloud Run pone este PORT

app.listen(PORT, '0.0.0.0', () => {
  console.log('Servidor escuchando en el puerto', PORT);

  // Diagnóstico SMTP: confirma credenciales de correo al arrancar
  verificarConexionCorreo()
    .then(() => console.log('✅ SMTP (correo) conectado correctamente como', process.env.MAIL_USER))
    .catch((err) => console.error('❌ SMTP (correo) falló el login:', err.message));
});

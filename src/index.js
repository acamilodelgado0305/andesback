import app from './app.js';
import './database.js';

async function main() {
  const PORT = process.env.PORT || app.get('port') || 8080;

  try {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Servidor escuchando en el puerto ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Error al iniciar el servidor:", error);
    process.exit(1);
  }
}

main();

const app = require('./app');

const PORT = Number(process.env.PORT) || 3000;


const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});


function cerrarServidor() {
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGTERM', cerrarServidor);
process.on('SIGINT', cerrarServidor);

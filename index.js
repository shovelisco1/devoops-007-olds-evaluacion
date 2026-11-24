const app = require('./app');
const { logEvent } = require('./logger');

const PORT = Number(process.env.PORT) || 3000;

const server = app.listen(PORT, '0.0.0.0', () => {
  logEvent('info', 'Microservicio iniciado', {
    port: PORT,
    node_version: process.version,
    environment: process.env.NODE_ENV || 'development'
  });
});

function cerrarServidor(signal) {
  logEvent('info', 'Cierre controlado solicitado', { signal });
  server.close(() => {
    logEvent('info', 'Servidor detenido correctamente');
    process.exit(0);
  });
}

process.on('SIGTERM', () => cerrarServidor('SIGTERM'));
process.on('SIGINT', () => cerrarServidor('SIGINT'));

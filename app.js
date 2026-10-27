const express = require('express');

const app = express();

// Reduce la información del servidor expuesta por defecto en las respuestas.
app.disable('x-powered-by');
app.use(express.json());

// Endpoint de salud usado por las pruebas y por Docker.
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'El microservicio está funcionando correctamente',
    version: '1.0.0'
  });
});

module.exports = app;

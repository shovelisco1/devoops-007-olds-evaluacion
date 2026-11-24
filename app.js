const express = require('express');
const { getMetrics, recordHttpRequest } = require('./metrics');
const { logEvent } = require('./logger');

const app = express();

app.disable('x-powered-by');
app.use(express.json());

// Registra cada solicitud terminada. Se omite /metrics para no contar los scrapes.
app.use((req, res, next) => {
  if (req.path === '/metrics') return next();

  const startTime = process.hrtime.bigint();
  res.once('finish', () => {
    const durationSeconds = Number(process.hrtime.bigint() - startTime) / 1_000_000_000;
    const route = req.route ? `${req.baseUrl || ''}${req.route.path}` : 'not_found';

    recordHttpRequest(req.method, route, res.statusCode, durationSeconds);
    logEvent(res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info', 'HTTP request completed', {
      method: req.method,
      route,
      status_code: res.statusCode,
      duration_ms: Number((durationSeconds * 1000).toFixed(3))
    });
  });

  next();
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'El microservicio está funcionando correctamente',
    version: '1.0.0'
  });
});

// Endpoints separados para las sondas de Kubernetes.
app.get('/api/live', (req, res) => {
  res.status(200).json({ status: 'success', message: 'Proceso activo' });
});

app.get('/api/ready', (req, res) => {
  res.status(200).json({ status: 'success', message: 'Microservicio listo para recibir tráfico' });
});

// Prometheus consulta este endpoint para recopilar métricas de aplicación y proceso.
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.status(200).send(getMetrics());
});

// Ruta disponible solo durante Jest para comprobar que los errores se registren.
if (process.env.NODE_ENV === 'test') {
  app.get('/api/test/error', (req, res, next) => {
    next(new Error('Error de prueba controlado'));
  });
}

app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Ruta no encontrada' });
});

app.use((error, req, res, next) => {
  logEvent('error', 'Unhandled application error', {
    method: req.method,
    path: req.path,
    error_message: error.message
  });

  if (res.headersSent) return next(error);
  res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
});

module.exports = app;

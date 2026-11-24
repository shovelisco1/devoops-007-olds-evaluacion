function logEvent(level, message, metadata = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: process.env.SERVICE_NAME || 'microservicio-evaluacion',
    message,
    ...metadata
  };

  process.stdout.write(`${JSON.stringify(entry)}\n`);
}

module.exports = { logEvent };


//se logra ver con docker compose logs -f microservicio

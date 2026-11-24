const request = require('supertest');
const app = require('./app');

describe('Pruebas del microservicio', () => {
  it('responde HTTP 200 en la ruta /api/health', async () => {
    const response = await request(app).get('/api/health');

    expect(response.statusCode).toBe(200);
  });

  it('indica que el estado del servicio es success', async () => {
    const response = await request(app).get('/api/health');

    expect(response.body.status).toBe('success');
  });

  it('devuelve la versión del microservicio', async () => {
    const response = await request(app).get('/api/health');

    expect(response.body.version).toBe('1.0.0');
    expect(response.body.message).toBe('El microservicio está funcionando correctamente');
    expect(response.headers['content-type']).toContain('application/json');
  });

  it('responde correctamente a las sondas de Kubernetes', async () => {
    const live = await request(app).get('/api/live');
    const ready = await request(app).get('/api/ready');

    expect(live.statusCode).toBe(200);
    expect(live.body.status).toBe('success');
    expect(ready.statusCode).toBe(200);
    expect(ready.body.status).toBe('success');
  });

  it('expone métricas Prometheus de solicitudes y del proceso', async () => {
    await request(app).get('/api/health');
    const response = await request(app).get('/metrics');

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.text).toContain('# TYPE http_requests_total counter');
    expect(response.text).toContain('http_requests_total{method="GET",route="/api/health",status_code="200"}');
    expect(response.text).toContain('process_resident_memory_bytes');
    expect(response.text).toContain('process_cpu_seconds_total');
  });

  it('registra respuestas 404 y errores 500 para observabilidad', async () => {
    const notFound = await request(app).get('/api/no-existe');
    const failure = await request(app).get('/api/test/error');
    const metrics = await request(app).get('/metrics');

    expect(notFound.statusCode).toBe(404);
    expect(failure.statusCode).toBe(500);
    expect(metrics.text).toContain('http_errors_total{method="GET",route="not_found",status_code="404"} 1');
    expect(metrics.text).toContain('http_errors_total{method="GET",route="/api/test/error",status_code="500"} 1');
  });
});

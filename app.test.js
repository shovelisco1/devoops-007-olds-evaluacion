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
    expect(response.headers['content-type']).toMatch(/application\/json/);
  });
});

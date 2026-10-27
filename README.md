# Microservicio de evaluación DevOps

Microservicio Node.js y Express con un endpoint de salud, pruebas automatizadas, análisis de dependencias y despliegue simulado usando Docker Compose.

## Requisitos

- Node.js 24 LTS y npm.
- La imagen Docker usa `node:24-bookworm-slim` y ejecuta Node directamente como usuario sin privilegios.
- Docker Desktop con Docker Compose.
- Repositorio en GitHub para ejecutar GitHub Actions.
- Un token de Snyk guardado en el repositorio como secreto `SNYK_TOKEN`.

## Puerto y endpoint

- Puerto dentro del contenedor: `3000`.
- Puerto predeterminado del equipo: `3000`.
- Endpoint de salud: `GET http://localhost:3000/api/health`.

Respuesta esperada:

```json
{
  "status": "success",
  "message": "El microservicio está funcionando correctamente",
  "version": "1.0.0"
}
```

Si el puerto 3000 está ocupado, se puede usar otro puerto del equipo:

```powershell
$env:HOST_PORT="3001"
docker compose up --build -d
```

En ese caso, el endpoint estará disponible en `http://localhost:3001/api/health`.

## Ejecutar localmente sin Docker

En la carpeta raíz del proyecto, ejecutar:

```bash
npm install
npm test
npm start
```

Luego abrir `http://localhost:3000/api/health`. El comando `npm install` crea `package-lock.json` si todavía no existe. Ese archivo debe subirse a Git para que `npm ci` pueda instalar las mismas versiones en CI y Docker.

## Si Docker informa `exec format error` al iniciar el contenedor

El Dockerfile usa una imagen base Debian slim y define `ENTRYPOINT ["node"]` para no depender del script `docker-entrypoint.sh` de la imagen base. Si el mismo error ocurre al ejecutar una imagen oficial de Node independientemente de este proyecto, el origen está en la instalación/arquitectura de Docker Desktop o WSL, y no en `app.js`; el código de la aplicación no puede reparar ese problema del motor.

## Ejecutar con Docker Compose

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f microservicio
docker compose down
```

Compose publica el puerto 3000 y aplica límites de CPU/memoria, usuario no root, sistema de archivos de solo lectura, eliminación de capacidades y restricción de privilegios.

## Pipeline CI/CD

El workflow `.github/workflows/ci.yml` se ejecuta al hacer `push` o abrir un `pull request` hacia `main` o `develop`. En orden:

1. Descarga el repositorio y configura Node.js.
2. Instala dependencias mediante `npm ci`.
3. Ejecuta las pruebas Jest/Supertest.
4. Bloquea el pipeline si `npm audit` informa vulnerabilidades altas o críticas.
5. Ejecuta Snyk y bloquea el pipeline ante vulnerabilidades altas o críticas.
6. Construye la imagen Docker.
7. Despliega temporalmente la aplicación mediante Docker Compose y comprueba `/api/health`.
8. Detiene los contenedores de prueba al terminar.

## Configurar Snyk en GitHub

1. Crear una cuenta en Snyk y obtener un token de API.
2. En GitHub, abrir el repositorio y entrar a **Settings → Secrets and variables → Actions**.
3. Crear un repositorio secret llamado `SNYK_TOKEN` y pegar el token como valor.
4. Volver a ejecutar el workflow desde **Actions**.

No guardar tokens, contraseñas ni archivos `.env` en el repositorio. El workflow requiere `SNYK_TOKEN`: si no está configurado o el análisis falla, el pipeline no continuará al despliegue.

## Dependabot y actualizaciones

El archivo `.github/dependabot.yml` revisa semanalmente las dependencias npm y las acciones utilizadas en GitHub Actions. Dependabot propone actualizaciones mediante pull requests; estas deben pasar el pipeline antes de integrarse.

## Trazabilidad y calidad

Cada ejecución de GitHub Actions queda asociada al commit o pull request que la inició. Los logs muestran las pruebas, análisis de seguridad, construcción de imagen y verificación del servicio. Las etapas posteriores no se ejecutan si falla una prueba o una revisión de seguridad.

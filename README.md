# Microservicio de evaluación DevOps — EP3

Microservicio Node.js + Express con CI/CD, pruebas automatizadas, auditoría de configuración, métricas Prometheus, dashboard Grafana y manifiestos para Kubernetes en Amazon EKS.

## 1. Arquitectura

- **Aplicación:** Node.js 24 y Express 4. Expone `/api/health`, `/api/live`, `/api/ready` y `/metrics`.
- **Logging:** eventos JSON por salida estándar. Docker muestra los logs con Compose y Amazon CloudWatch los puede centralizar mediante el complemento de observabilidad de EKS.
- **Métricas:** contadores de solicitudes y errores HTTP, latencia, memoria RSS, heap, CPU y uptime del proceso Node.js.
- **Monitoreo local:** Prometheus recopila las métricas; Pushgateway recibe cobertura y duración del despliegue de CI; Grafana presenta el dashboard.
- **Kubernetes:** manifiestos de Deployment, Service, ConfigMap, sondas de salud y límites de recursos para Amazon EKS.
- **Calidad y cumplimiento:** Jest con umbral de cobertura, `npm audit`, auditoría personalizada del Dockerfile/Compose y protección de ramas en GitHub.

## 2. Ejecutar pruebas

Requisitos: Node.js 24 y npm.

```bash
npm ci
npm test
npm run test:ci
npm run audit
```

`npm run test:ci` genera `coverage/coverage-summary.json` y detiene la ejecución si no se cumplen los umbrales definidos en `package.json`.

## 3. Ejecutar microservicio y observabilidad en local

Requisitos: Docker Desktop y Docker Compose.

1. Instala las dependencias y genera la cobertura que el dashboard mostrará:

```bash
npm ci
npm run test:ci
```

2. Opcionalmente, crea un archivo `.env` desde `.env.example` y cambia `GRAFANA_ADMIN_PASSWORD`.
3. Inicia la aplicación, Prometheus, Pushgateway y Grafana. El script espera los healthchecks y publica cobertura/duración al Pushgateway:

```bash
npm run monitoring:up
```

4. Comprueba los servicios:

```bash
docker compose --profile monitoring ps
curl http://localhost:3000/api/health
curl http://localhost:3000/api/ready
curl http://localhost:3000/metrics
```

4. Abre las interfaces:

| Herramienta | Dirección | Uso |
|---|---|---|
| Microservicio | http://localhost:3000/api/health | Disponibilidad |
| Métricas | http://localhost:3000/metrics | Formato Prometheus |
| Prometheus | http://localhost:9090 | Consultas y targets |
| Grafana | http://localhost:3001 | Dashboard EP3 |
| Pushgateway | http://localhost:9091 | Métricas CI/CD recibidas |

Grafana utiliza el usuario `admin`. La contraseña local predeterminada del Compose es `cambiar-esta-clave`; cámbiala en `.env` antes de compartir o publicar el entorno.

El dashboard se provisiona automáticamente en Grafana bajo la carpeta **DevOps EP3**. Contiene disponibilidad, solicitudes por segundo, porcentaje de respuestas 4xx/5xx, latencia p95, CPU, memoria RSS, cobertura de pruebas y duración del despliegue.

Para revisar logs estructurados:

```bash
docker compose logs -f microservicio
```

Los logs contienen timestamp, nivel, nombre del servicio, ruta, método, código HTTP y duración. No se escriben archivos de log dentro del contenedor.

Para detener el entorno:

```bash
docker compose --profile monitoring down
```

Los volúmenes de Prometheus y Grafana se conservan. Para borrar también los datos locales guardados:

```bash
docker compose --profile monitoring down -v
```

## 4. Pipeline CI/CD

El workflow `.github/workflows/ci.yml` ejecuta en `push` y `pull_request` hacia `main` y `develop`:

1. Instala las dependencias reproduciblemente con `npm ci`.
2. Ejecuta Jest y calcula cobertura de líneas.
3. Comprueba las reglas de configuración segura mediante `npm run audit`.
4. Ejecuta `npm audit --audit-level=high` y falla con vulnerabilidades altas o críticas.
5. Construye e inicia la aplicación y el stack de monitoreo con Docker Compose.
6. Comprueba `/api/health`.
7. Mide la duración del despliegue y envía cobertura y duración a Pushgateway para que Prometheus las recoja.
8. Detiene el entorno de prueba aunque una etapa falle.

El archivo `.github/workflows/deploy-eks.yml` permite lanzar manualmente el despliegue automatizado en AWS EKS. Requiere configurar las variables y secretos descritos en `k8s/README-AWS.md`.

## 5. Políticas de calidad y cumplimiento

El pipeline bloquea la ejecución cuando:

- Falla una prueba automatizada.
- La cobertura cae por debajo de los umbrales de Jest configurados en `package.json`.
- `npm audit` encuentra vulnerabilidades de nivel alto o crítico.
- La auditoría personalizada detecta que se perdió una configuración de seguridad obligatoria.
- Docker no puede construir o el endpoint de salud no responde.

Además, en GitHub se debe proteger la rama `main` y exigir que pase el check **Pruebas, auditoría y despliegue simulado** antes de permitir el merge. La configuración se realiza en **Settings → Branches → Add branch protection rule**. Se recomienda exigir Pull Request, bloquear force-push y exigir el check de GitHub Actions.

## 6. Despliegue en AWS EKS

Los manifiestos y scripts están en `k8s/`. El procedimiento paso a paso, IAM, Amazon ECR, CloudWatch, dashboards, validación y limpieza está documentado en [`k8s/README-AWS.md`](k8s/README-AWS.md).

No ejecutar la creación del clúster sin revisar antes los cargos de AWS. Amazon EKS cobra por hora de clúster y también se pagan los nodos EC2, discos EBS, direcciones IP públicas y otros recursos utilizados. Consulta los precios vigentes en https://aws.amazon.com/eks/pricing/.

## 7. Uso de IA en el trabajo

Para cumplir la indicación de la pauta, el equipo debe declarar y citar las herramientas de IA que realmente utilizó. Ejemplo que debe ser revisado y adaptado por el equipo: “Se utilizó ChatGPT como apoyo para revisar configuraciones, proponer estructura de monitoreo y explicar herramientas DevOps. El equipo revisó, ejecutó y validó las configuraciones antes de incorporarlas”.

Las conclusiones y reflexiones individuales deben ser escritas por cada integrante sin apoyo de IA, tal como exige la pauta de la evaluación.

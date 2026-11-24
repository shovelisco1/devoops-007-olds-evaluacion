# Despliegue de la EP3 en Amazon EKS

Esta guía despliega el microservicio en Kubernetes administrado por AWS (EKS), publica la imagen en ECR, instala Prometheus/Grafana y habilita la recolección de logs y métricas con CloudWatch.

## 0. Costos antes de empezar

Amazon EKS cobra actualmente **USD 0,10 por hora de clúster** para versiones con soporte estándar. Eso equivale aproximadamente a USD 72 por 30 días, solo por el plano de control. A eso se agregan los nodos EC2, discos EBS, direcciones IPv4 públicas, transferencia y almacenamiento/ingesta de CloudWatch. Revisa los precios de tu región en https://aws.amazon.com/eks/pricing/.

Para controlar gastos, crea el clúster solo cuando vayas a trabajar en la nube y elimínalo después de tomar las evidencias. No basta con detener los Pods: el plano de control de EKS sigue generando cargos mientras exista el clúster.

## 1. Herramientas necesarias en Windows

Instala y verifica:

- AWS CLI v2.
- eksctl.
- kubectl.
- Helm 3.
- Docker Desktop.
- Git Bash (los scripts `.sh` están preparados para este terminal).

Comprueba la identidad y permisos de AWS:

```bash
aws --version
eksctl version
kubectl version --client
helm version
docker version
aws sts get-caller-identity
```

La cuenta debe tener permisos para EKS, EC2, CloudFormation, IAM, ECR y la administración de recursos Kubernetes. No compartas access keys, tokens ni archivos `~/.aws/credentials`.

## 2. Crear un clúster EKS

La configuración inicial utiliza un nodo administrado `t3.large` para que puedan ejecutarse la aplicación y el stack de monitoreo. Es un entorno académico pequeño, no una arquitectura de producción.

Desde Git Bash, en la carpeta raíz del repositorio:

```bash
export AWS_REGION=us-east-1
export EKS_CLUSTER_NAME=devops-ep3
bash k8s/create-cluster.sh
```

El script pide escribir `CREAR` antes de ejecutar la creación. Cambia la región si tu cuenta o tu docente requieren otra.

Verifica:

```bash
aws eks update-kubeconfig --name "$EKS_CLUSTER_NAME" --region "$AWS_REGION"
kubectl get nodes
```

## 3. Publicar la imagen en Amazon ECR y desplegar el microservicio

```bash
export AWS_REGION=us-east-1
export EKS_CLUSTER_NAME=devops-ep3
export ECR_REPOSITORY=microservicio-evaluacion
bash k8s/deploy-aws.sh
```

El script crea el repositorio ECR si aún no existe, construye la imagen, la publica, aplica los manifiestos y espera que el Deployment esté disponible. Antes de desplegar, confirma que los cambios del proyecto estén guardados en Git; el tag local se genera a partir del commit actual.

Comprobaciones:

```bash
kubectl get deployments,services,pods -n microservicio
kubectl rollout status deployment/microservicio -n microservicio
kubectl logs -l app=microservicio -n microservicio --all-containers=true --prefix=true
```

El Service se deja como `ClusterIP` para no publicar automáticamente el endpoint `/metrics` a Internet. Para probar el microservicio desde el equipo:

```bash
kubectl port-forward service/microservicio 3000:3000 -n microservicio
```

En otra terminal:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/metrics
```

## 4. Instalar Prometheus y Grafana en EKS

Define una contraseña segura en la sesión de Git Bash (no la escribas en archivos del repositorio):

```bash
export GRAFANA_ADMIN_PASSWORD='CAMBIA-ESTA-CONTRASENA'
bash k8s/setup-monitoring.sh
```

El script instala `kube-prometheus-stack`, Pushgateway, ServiceMonitors y el dashboard EP3. El ServiceMonitor recoge `/metrics` desde el servicio `microservicio`; Pushgateway recibe la cobertura Jest y la duración del despliegue.

Abre Grafana con un port-forward:

```bash
kubectl port-forward service/monitoring-grafana 3001:80 -n monitoring
```

Luego visita http://localhost:3001. Usuario: `admin`. Contraseña: el valor usado en `GRAFANA_ADMIN_PASSWORD`.

Verifica que Prometheus esté recopilando datos:

```bash
kubectl get pods -n monitoring
kubectl get servicemonitors -n monitoring
```

## 5. Logs y métricas en AWS CloudWatch

La aplicación escribe logs estructurados JSON a stdout. Para centralizar logs de Pods, métricas de infraestructura y señales de observabilidad se utiliza el complemento oficial **Amazon CloudWatch Observability** para EKS. Requiere un rol IAM con `CloudWatchAgentServerPolicy` y `AWSXrayWriteOnlyAccess`.

Ejecuta una vez, después de crear el clúster, si tu cuenta tiene permisos IAM para crear el rol:

```bash
export AWS_REGION=us-east-1
export EKS_CLUSTER_NAME=devops-ep3
bash k8s/enable-cloudwatch-observability.sh
```

Consulta los logs de la aplicación en CloudWatch Logs, grupo:

`/aws/containerinsights/devops-ep3/application`

También se pueden revisar directamente con `kubectl logs`, que es útil para la demostración de la evaluación.

## 6. Automatizar despliegues desde GitHub Actions

El workflow `.github/workflows/deploy-eks.yml` se inicia desde **GitHub → Actions → Deploy microservicio en AWS EKS → Run workflow**. Antes hay que preparar OIDC en AWS IAM y dar al rol de GitHub los permisos requeridos. No guardes access keys permanentes en GitHub.

Crea en el repositorio GitHub las siguientes **Variables**:

| Nombre | Ejemplo |
|---|---|
| `AWS_REGION` | `us-east-1` |
| `EKS_CLUSTER_NAME` | `devops-ep3` |
| `ECR_REPOSITORY` | `microservicio-evaluacion` |

Crea los siguientes **Secrets**:

| Nombre | Contenido |
|---|---|
| `AWS_ROLE_TO_ASSUME` | ARN del rol IAM que GitHub asume mediante OIDC |
| `GRAFANA_ADMIN_PASSWORD` | Contraseña de administración de Grafana |

El rol IAM necesita permisos de escritura en el repositorio ECR, `eks:DescribeCluster` y autorización Kubernetes para actualizar recursos en los namespaces `microservicio` y `monitoring`. Para una entrega académica se puede autorizar el rol mediante un EKS access entry con `AmazonEKSClusterAdminPolicy`, pero para producción se debe aplicar mínimo privilegio.

Configura el proveedor OIDC `token.actions.githubusercontent.com` en IAM y restringe la relación de confianza al repositorio y rama esperados. Los claims `sub` de GitHub pueden variar según la antigüedad y configuración del repositorio; usa la guía oficial de AWS para el formato vigente: https://github.com/aws-actions/configure-aws-credentials.

Después de configurar OIDC, variables, secretos y autorización de EKS, ejecuta el workflow manualmente. El workflow vuelve a correr pruebas, auditorías, construye y publica la imagen, despliega en EKS, espera el rollout y envía métricas CI/CD al Pushgateway del clúster.

## 7. Proteger la rama main

En GitHub, abre **Settings → Branches → Add branch protection rule** y aplica a `main`:

- Require a pull request before merging.
- Require status checks to pass before merging.
- Selecciona `Pruebas, auditoría y despliegue simulado`.
- Block force pushes y deletion.

Así GitHub impedirá fusionar cambios cuando fallen las pruebas, la cobertura, la auditoría, npm audit o el despliegue simulado.

## 8. Evidencias para la evaluación

Guarda capturas de:

1. Workflow CI/CD exitoso en GitHub Actions.
2. Una ejecución fallida controlada en una rama de prueba por una prueba o auditoría crítica, y luego su corrección.
3. Dashboard Grafana con disponibilidad, errores, latencia, CPU/memoria, cobertura y duración del despliegue.
4. Pods y Deployment activos en EKS (`kubectl get deployments,pods -n microservicio`).
5. Logs JSON consultables con `kubectl logs` y en CloudWatch Logs.
6. ServiceMonitor de Prometheus (`kubectl get servicemonitors -n monitoring`).
7. Regla de protección de la rama `main` en GitHub.

No simules una falla en la rama principal. Utiliza una rama temporal, demuestra que el pipeline se detiene y corrige o elimina esa rama después.

## 9. Eliminar recursos y evitar cargos

Cuando termines las pruebas y evidencias, elimina el clúster con:

```bash
eksctl delete cluster --name "$EKS_CLUSTER_NAME" --region "$AWS_REGION"
```

Esto elimina el clúster y los recursos administrados por eksctl. Revisa igualmente ECR, volúmenes EBS, IP públicas, snapshots y grupos de logs de CloudWatch por si quedaron recursos independientes. Si deseas eliminar el repositorio de imágenes (y no necesitas conservarlo):

```bash
aws ecr delete-repository --repository-name "$ECR_REPOSITORY" --region "$AWS_REGION" --force
```

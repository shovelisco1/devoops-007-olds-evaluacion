const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const errors = [];

function read(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    errors.push(`Falta el archivo requerido: ${relativePath}`);
    return '';
  }
  return fs.readFileSync(fullPath, 'utf8');
}

const dockerfile = read('Dockerfile');
const compose = read('docker-compose.yml');
const gitignore = read('.gitignore');
const workflow = read('.github/workflows/ci.yml');
const packageLock = path.join(root, 'package-lock.json');
const kubernetes = read('k8s/app.yaml');

if (!/USER\s+1000:1000/.test(dockerfile)) errors.push('El contenedor debe ejecutarse como usuario no root (USER 1000:1000).');
if (!/read_only:\s*true/.test(compose)) errors.push('Docker Compose debe mantener read_only: true.');
if (!/no-new-privileges:true/.test(compose)) errors.push('Docker Compose debe mantener no-new-privileges:true.');
if (!/cap_drop:[\s\S]*-\s*ALL/.test(compose)) errors.push('Docker Compose debe eliminar todas las capabilities.');
if (!/runAsNonRoot:\s*true/.test(kubernetes)) errors.push('Kubernetes debe ejecutar el contenedor como usuario no root.');
if (!/readOnlyRootFilesystem:\s*true/.test(kubernetes)) errors.push('Kubernetes debe usar un filesystem de solo lectura.');
if (!/allowPrivilegeEscalation:\s*false/.test(kubernetes)) errors.push('Kubernetes debe impedir la elevación de privilegios.');
if (!/capabilities:[\s\S]*drop:[\s\S]*-\s*ALL/.test(kubernetes)) errors.push('Kubernetes debe eliminar todas las capabilities.');
if (!/^\.env$/m.test(gitignore)) errors.push('.env debe estar excluido de Git.');
if (!fs.existsSync(packageLock)) errors.push('Falta package-lock.json para instalaciones reproducibles.');
if (!workflow.includes('npm audit --audit-level=high')) errors.push('El pipeline debe ejecutar npm audit con severidad high.');
if (!workflow.includes('npm run test:ci')) errors.push('El pipeline debe ejecutar pruebas con cobertura.');
if (!workflow.includes('npm run audit')) errors.push('El pipeline debe ejecutar esta auditoría de configuración.');

const filesToScan = ['app.js', 'index.js', 'metrics.js', 'logger.js', 'Dockerfile', 'docker-compose.yml', 'k8s/app.yaml'];
for (const relativePath of filesToScan) {
  const content = read(relativePath);
  if (/\bAKIA[0-9A-Z]{16}\b/.test(content)) errors.push(`Posible AWS access key incrustada en ${relativePath}.`);
  if (/-----BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY-----/.test(content)) errors.push(`Clave privada incrustada en ${relativePath}.`);
}

if (errors.length > 0) {
  console.error('AUDITORÍA DE CUMPLIMIENTO: FALLIDA');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('AUDITORÍA DE CUMPLIMIENTO: CORRECTA');
console.log('- Imagen Docker no root.');
console.log('- Sistema de archivos de solo lectura.');
console.log('- Sin privilegios adicionales ni capabilities.');
console.log('- Manifiestos Kubernetes con controles de seguridad.');
console.log('- Archivos principales revisados en busca de credenciales incrustadas.');
console.log('- Secretos locales excluidos de Git.');
console.log('- Dependencias reproducibles y controles CI configurados.');

const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const summaryPath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
  if (!fs.existsSync(summaryPath)) {
    throw new Error('No existe coverage/coverage-summary.json. Ejecuta npm run test:ci primero.');
  }

  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const coverage = Number(summary.total?.lines?.pct);
  const deploymentDuration = Number(process.env.CI_DEPLOYMENT_DURATION_SECONDS);

  if (!Number.isFinite(coverage)) throw new Error('No se pudo leer la cobertura de líneas de Jest.');
  if (!Number.isFinite(deploymentDuration) || deploymentDuration < 0) {
    throw new Error('CI_DEPLOYMENT_DURATION_SECONDS debe contener la duración del despliegue en segundos.');
  }

  const pushgateway = (process.env.PROMETHEUS_PUSHGATEWAY_URL || 'http://127.0.0.1:9091').replace(/\/$/, '');
  const rawBranch = process.env.GITHUB_REF_NAME || 'local';
  const branch = rawBranch.replace(/[^A-Za-z0-9_.-]/g, '-');
  const job = 'devops_ep3_pipeline';
  const url = `${pushgateway}/metrics/job/${encodeURIComponent(job)}/branch/${encodeURIComponent(branch)}`;
  const body = [
    '# HELP ci_test_coverage_percent Percentage of source lines covered by Jest tests.',
    '# TYPE ci_test_coverage_percent gauge',
    `ci_test_coverage_percent ${coverage}`,
    '# HELP ci_deployment_duration_seconds Duration of the simulated deployment in seconds.',
    '# TYPE ci_deployment_duration_seconds gauge',
    `ci_deployment_duration_seconds ${deploymentDuration}`,
    ''
  ].join('\n');

  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain; version=0.0.4' },
    body
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Pushgateway respondió ${response.status}: ${detail}`);
  }

  console.log(`Métricas CI enviadas: cobertura=${coverage}% y despliegue=${deploymentDuration}s`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

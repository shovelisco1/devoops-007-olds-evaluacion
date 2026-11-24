const os = require('node:os');

const HISTOGRAM_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];
const requestMetrics = new Map();
const processStartTimeSeconds = Date.now() / 1000;

function escapeLabel(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/"/g, '\\"');
}

function formatLabels(labels) {
  const entries = Object.entries(labels);
  if (entries.length === 0) return '';
  return `{${entries.map(([name, value]) => `${name}="${escapeLabel(value)}"`).join(',')}}`;
}

function recordHttpRequest(method, route, statusCode, durationSeconds) {
  const labels = {
    method: String(method),
    route: String(route),
    status_code: String(statusCode)
  };
  const key = JSON.stringify(labels);
  let metric = requestMetrics.get(key);

  if (!metric) {
    metric = {
      labels,
      count: 0,
      sum: 0,
      buckets: HISTOGRAM_BUCKETS.map(() => 0),
      errors: 0
    };
    requestMetrics.set(key, metric);
  }

  const safeDuration = Math.max(0, Number(durationSeconds) || 0);
  metric.count += 1;
  metric.sum += safeDuration;
  for (let index = 0; index < HISTOGRAM_BUCKETS.length; index += 1) {
    if (safeDuration <= HISTOGRAM_BUCKETS[index]) {
      metric.buckets[index] += 1;
    }
  }
  if (Number(statusCode) >= 400) metric.errors += 1;
}

function getMetrics() {
  const lines = [];
  const memory = process.memoryUsage();
  const cpu = process.cpuUsage();
  const uptime = process.uptime();
  const environment = process.env.NODE_ENV || 'development';
  const version = '1.0.0';

  lines.push('# HELP microservice_info Information about this microservice.');
  lines.push('# TYPE microservice_info gauge');
  lines.push(`microservice_info${formatLabels({ version, environment, node_version: process.version })} 1`);

  lines.push('# HELP microservice_up Whether the process is running.');
  lines.push('# TYPE microservice_up gauge');
  lines.push('microservice_up 1');

  lines.push('# HELP http_requests_total Total number of completed HTTP requests.');
  lines.push('# TYPE http_requests_total counter');
  lines.push('# HELP http_errors_total Total number of HTTP 4xx and 5xx responses.');
  lines.push('# TYPE http_errors_total counter');
  for (const metric of requestMetrics.values()) {
    lines.push(`http_requests_total${formatLabels(metric.labels)} ${metric.count}`);
    lines.push(`http_errors_total${formatLabels(metric.labels)} ${metric.errors}`);
  }

  lines.push('# HELP http_request_duration_seconds HTTP request duration in seconds.');
  lines.push('# TYPE http_request_duration_seconds histogram');
  for (const metric of requestMetrics.values()) {
    for (let index = 0; index < HISTOGRAM_BUCKETS.length; index += 1) {
      const labels = { ...metric.labels, le: HISTOGRAM_BUCKETS[index] };
      lines.push(`http_request_duration_seconds_bucket${formatLabels(labels)} ${metric.buckets[index]}`);
    }
    lines.push(`http_request_duration_seconds_bucket${formatLabels({ ...metric.labels, le: '+Inf' })} ${metric.count}`);
    lines.push(`http_request_duration_seconds_sum${formatLabels(metric.labels)} ${metric.sum}`);
    lines.push(`http_request_duration_seconds_count${formatLabels(metric.labels)} ${metric.count}`);
  }

  lines.push('# HELP process_resident_memory_bytes Resident memory size in bytes.');
  lines.push('# TYPE process_resident_memory_bytes gauge');
  lines.push(`process_resident_memory_bytes ${memory.rss}`);
  lines.push('# HELP process_heap_used_bytes V8 heap memory used in bytes.');
  lines.push('# TYPE process_heap_used_bytes gauge');
  lines.push(`process_heap_used_bytes ${memory.heapUsed}`);
  lines.push('# HELP process_heap_total_bytes V8 heap memory allocated in bytes.');
  lines.push('# TYPE process_heap_total_bytes gauge');
  lines.push(`process_heap_total_bytes ${memory.heapTotal}`);
  lines.push('# HELP process_cpu_seconds_total Total CPU time consumed by the process, in seconds.');
  lines.push('# TYPE process_cpu_seconds_total counter');
  lines.push(`process_cpu_seconds_total${formatLabels({ mode: 'user' })} ${cpu.user / 1_000_000}`);
  lines.push(`process_cpu_seconds_total${formatLabels({ mode: 'system' })} ${cpu.system / 1_000_000}`);
  lines.push('# HELP process_uptime_seconds Process uptime in seconds.');
  lines.push('# TYPE process_uptime_seconds gauge');
  lines.push(`process_uptime_seconds ${uptime}`);
  lines.push('# HELP process_start_time_seconds Start time of the process since unix epoch in seconds.');
  lines.push('# TYPE process_start_time_seconds gauge');
  lines.push(`process_start_time_seconds ${processStartTimeSeconds}`);

  lines.push('# HELP system_load_average_1m System load average over 1 minute.');
  lines.push('# TYPE system_load_average_1m gauge');
  lines.push(`system_load_average_1m ${os.loadavg()[0] || 0}`);

  return `${lines.join('\n')}\n`;
}

module.exports = {
  getMetrics,
  recordHttpRequest
};

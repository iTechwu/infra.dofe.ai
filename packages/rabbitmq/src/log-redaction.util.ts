/**
 * Mask credentials embedded in connection URLs (0629 · OPZ-03).
 *
 * RabbitMQ/amqp connection URLs carry `user:password@` authorities
 * (`RABBITMQ_URL`, `RABBITMQ_EVENTS_URL`), and amqplib error messages echo the
 * URL on connect failures. Before this utility, the events module logged the
 * full URL on a successful non-production connect, and the service logged raw
 * amqplib error messages — both leak credentials into routine startup/error
 * logs. `redactUrlCredentials` rewrites the `scheme://user:pass@` authority to
 * `scheme://***@` while preserving host/port/vhost for diagnostics.
 */
const URL_CREDENTIAL_PATTERN = /([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^\s:/@]*):([^\s/@]+)@/g;

export function redactUrlCredentials(value: string): string {
  return value.replace(URL_CREDENTIAL_PATTERN, '$1://***@');
}

/** Redact credentials from an unknown error-like value, returning a string. */
export function redactErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return redactUrlCredentials(message);
}

/**
 * Severity for the RabbitMQ connection-closed log (0629 · OPZ-04).
 *
 * A close during shutdown (`onModuleDestroy` has set `isShuttingDown`) is an
 * expected, benign race — downgrade it to `debug` so operators can distinguish
 * it from a real mid-run connection loss (which stays `warn`).
 */
export function connectionClosedSeverity(isShuttingDown: boolean): 'debug' | 'warn' {
  return isShuttingDown ? 'debug' : 'warn';
}

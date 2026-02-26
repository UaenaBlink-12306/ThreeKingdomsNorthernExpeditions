type ErrorContext = Record<string, unknown> | undefined;

interface NormalizedError {
  name: string;
  message: string;
  stack?: string;
}

let globalLoggingInitialized = false;

function normalizeError(error: unknown): NormalizedError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return {
    name: "NonErrorThrowable",
    message: String(error),
  };
}

export function reportConsoleError(scope: string, error: unknown, context?: ErrorContext): void {
  const normalized = normalizeError(error);
  console.error(`[${scope}]`, {
    timestamp: new Date().toISOString(),
    ...normalized,
    context,
    raw: error,
  });
}

export function setupGlobalErrorLogging(): void {
  if (globalLoggingInitialized) {
    return;
  }
  globalLoggingInitialized = true;

  window.addEventListener("error", (event) => {
    reportConsoleError("window.error", event.error ?? event.message, {
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportConsoleError("window.unhandledrejection", event.reason);
  });
}

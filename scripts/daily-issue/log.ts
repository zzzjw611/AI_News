type Level = 'info' | 'warn' | 'error' | 'debug';

function emit(level: Level, event: string, data?: Record<string, unknown>): void {
  const line = { ts: new Date().toISOString(), level, event, ...data };
  const stream = level === 'error' ? process.stderr : process.stdout;
  stream.write(JSON.stringify(line) + '\n');
}

export const log = {
  info: (event: string, data?: Record<string, unknown>) => emit('info', event, data),
  warn: (event: string, data?: Record<string, unknown>) => emit('warn', event, data),
  error: (event: string, data?: Record<string, unknown>) => emit('error', event, data),
  debug: (event: string, data?: Record<string, unknown>) => {
    if (process.env.DEBUG) emit('debug', event, data);
  },
};

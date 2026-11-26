const original = process.emit.bind(process);

process.emit = ((event: string, ...args: unknown[]) => {
  if (event === 'warning') {
    const warning = args[0] as { name?: string } | undefined;
    if (warning?.name === 'ExperimentalWarning') return false;
  }
  return original(event as 'warning', ...(args as [Error]));
}) as typeof process.emit;

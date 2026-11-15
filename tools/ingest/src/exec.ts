import { spawn } from 'node:child_process';

export class CommandError extends Error {
  constructor(
    readonly command: string,
    readonly code: number | null,
    readonly stderr: string,
  ) {
    super(
      `${command} exited with code ${code}: ${stderr.trim().split('\n').slice(-3).join(' | ')}`,
    );
  }
}

/** Runs a binary without a shell (no quoting issues on Windows) and captures its output. */
export function run(
  command: string,
  args: string[],
  opts: { cwd?: string } = {},
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: opts.cwd, windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    child.on('error', (err: NodeJS.ErrnoException) => {
      reject(err.code === 'ENOENT' ? new Error(`"${command}" was not found in PATH`) : err);
    });
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new CommandError(command, code, stderr));
    });
  });
}

export async function isAvailable(command: string, versionArg = '-version'): Promise<boolean> {
  try {
    await run(command, [versionArg]);
    return true;
  } catch {
    return false;
  }
}

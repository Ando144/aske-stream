// Runs the Android Gradle wrapper on any OS: node scripts/gradle.mjs assembleRelease
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const androidDir = fileURLToPath(new URL('../android/', import.meta.url));
const isWin = process.platform === 'win32';
const gradlew = join(androidDir, isWin ? 'gradlew.bat' : 'gradlew');
const args = process.argv.slice(2);

if (!existsSync(gradlew)) {
  console.error(`Falta ${gradlew}; ejecuta \`npx cap sync android\``);
  process.exit(1);
}

const options = { cwd: androidDir, stdio: 'inherit' };
// A .bat needs cmd.exe. With /s it strips the outer pair of quotes, which keeps the inner pair
// around a path with spaces.
const result = isWin
  ? spawnSync('cmd.exe', ['/d', '/s', '/c', `""${gradlew}" ${args.join(' ')}"`], {
      ...options,
      windowsVerbatimArguments: true,
    })
  : spawnSync(gradlew, args, options);
if (result.error) console.error(`No se pudo ejecutar ${gradlew}: ${result.error.message}`);
process.exit(result.status ?? 1);

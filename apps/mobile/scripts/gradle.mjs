// Runs the Android Gradle wrapper on any OS: node scripts/gradle.mjs assembleRelease
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const androidDir = fileURLToPath(new URL('../android/', import.meta.url));
const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const result = spawnSync(gradlew, process.argv.slice(2), {
  cwd: androidDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);

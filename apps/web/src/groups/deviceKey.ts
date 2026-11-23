import { GROUP_LIMITS } from '@aske/shared/groups';
import { loadValue, savePref } from '../lib/storage';

const PREF = 'groups-device-key';
const HEX = new RegExp(`^[0-9a-f]{${GROUP_LIMITS.deviceKeyHexLength}}$`);

function randomKey(): string {
  const bytes = new Uint8Array(GROUP_LIMITS.deviceKeyHexLength / 2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Random secret that identifies this device in groups. The Hub only keeps its hash. */
export function getDeviceKey(): string {
  const saved = loadValue<string>(PREF, '');
  if (HEX.test(saved)) return saved;
  return resetDeviceKey();
}

/** New identity: the old one can no longer be linked to this device. */
export function resetDeviceKey(): string {
  const key = randomKey();
  savePref(PREF, key);
  return key;
}

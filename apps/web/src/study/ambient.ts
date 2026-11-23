import { brownNoise, makeSeamless, whiteNoise } from './noise';

export type AmbientId = 'white' | 'gray' | 'brown' | 'rain' | 'waves';

const NOISE_SECONDS = 10;
const SEAM_SECONDS = 0.5;
const LEVEL_TIME_CONSTANT = 0.3;
const DEFAULT_FADE_MS = 1000;
const FILE_IDS: AmbientId[] = ['rain', 'waves'];

const files = import.meta.glob('./sounds/*.ogg', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

interface Voice {
  gain: GainNode;
  source: AudioBufferSourceNode;
}

let ctx: AudioContext | null = null;
const voices = new Map<AmbientId, Voice>();
const fileBuffers = new Map<AmbientId, AudioBuffer>();

function fileUrl(id: AmbientId): string | undefined {
  return files[`./sounds/${id}.ogg`];
}

export function availableAmbient(): AmbientId[] {
  return ['white', 'gray', 'brown', ...FILE_IDS.filter((id) => fileUrl(id))];
}

function audioContext(): AudioContext {
  ctx ??= new AudioContext();
  return ctx;
}

function noiseBuffer(c: AudioContext, kind: 'white' | 'brown'): AudioBuffer {
  const raw =
    kind === 'white'
      ? whiteNoise(c.sampleRate * NOISE_SECONDS)
      : brownNoise(c.sampleRate * NOISE_SECONDS);
  const data = makeSeamless(raw, Math.floor(c.sampleRate * SEAM_SECONDS));
  const buffer = c.createBuffer(1, data.length, c.sampleRate);
  buffer.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
  return buffer;
}

async function fileBuffer(c: AudioContext, id: AmbientId): Promise<AudioBuffer | null> {
  const cached = fileBuffers.get(id);
  if (cached) return cached;
  const url = fileUrl(id);
  if (!url) return null;
  try {
    const response = await fetch(url);
    const decoded = await c.decodeAudioData(await response.arrayBuffer());
    fileBuffers.set(id, decoded);
    return decoded;
  } catch (err) {
    console.error(`Could not load the ambient sound "${id}"`, err);
    return null;
  }
}

async function bufferFor(c: AudioContext, id: AmbientId): Promise<AudioBuffer | null> {
  if (id === 'white' || id === 'gray') return noiseBuffer(c, 'white');
  if (id === 'brown') return noiseBuffer(c, 'brown');
  return fileBuffer(c, id);
}

function grayFilters(c: AudioContext, input: AudioNode): AudioNode {
  const low = c.createBiquadFilter();
  low.type = 'lowshelf';
  low.frequency.value = 250;
  low.gain.value = 10;
  const mid = c.createBiquadFilter();
  mid.type = 'peaking';
  mid.frequency.value = 3000;
  mid.Q.value = 1;
  mid.gain.value = -6;
  const high = c.createBiquadFilter();
  high.type = 'highshelf';
  high.frequency.value = 10_000;
  high.gain.value = 4;
  input.connect(low);
  low.connect(mid);
  mid.connect(high);
  return high;
}

async function startVoice(c: AudioContext, id: AmbientId): Promise<Voice | null> {
  const buffer = await bufferFor(c, id);
  if (!buffer) return null;
  const source = c.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const gain = c.createGain();
  gain.gain.value = 0;
  (id === 'gray' ? grayFilters(c, source) : source).connect(gain);
  gain.connect(c.destination);
  source.start();
  return { gain, source };
}

function stopVoice(c: AudioContext, id: AmbientId, voice: Voice, fadeMs: number): void {
  voices.delete(id);
  const fadeS = fadeMs / 1000;
  voice.gain.gain.setTargetAtTime(0, c.currentTime, fadeS / 3);
  voice.source.stop(c.currentTime + fadeS + 0.1);
}

export async function setAmbientLevel(id: AmbientId, level: number): Promise<void> {
  const c = audioContext();
  await c.resume();
  const clamped = Math.min(1, Math.max(0, level));
  let voice = voices.get(id);
  if (clamped === 0) {
    if (voice) stopVoice(c, id, voice, DEFAULT_FADE_MS);
    return;
  }
  if (!voice) {
    const started = await startVoice(c, id);
    if (!started) return;
    // A concurrent call may have created the voice while we were loading.
    if (voices.has(id)) {
      started.source.stop();
      voice = voices.get(id);
    } else {
      voices.set(id, started);
      voice = started;
    }
  }
  voice?.gain.gain.setTargetAtTime(clamped, c.currentTime, LEVEL_TIME_CONSTANT);
}

export function stopAllAmbient(fadeMs: number = DEFAULT_FADE_MS): void {
  if (!ctx) return;
  for (const [id, voice] of [...voices]) stopVoice(ctx, id, voice, fadeMs);
}

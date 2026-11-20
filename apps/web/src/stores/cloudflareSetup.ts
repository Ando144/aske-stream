import { create } from 'zustand';
import { createCfApi, type CfApi } from '../cloudflare/api';
import { loadBundle, type WorkerBundle } from '../cloudflare/bundle';
import { workerUrl } from '../cloudflare/deploy';
import { getSubdomain, listAccounts, scriptExists, verifyToken } from '../cloudflare/resources';
import {
  runSetup,
  runUpdate,
  SetupError,
  waitUntilLive,
  type SetupErrorCode,
  type SetupStep,
} from '../cloudflare/setup';
import { CfError } from '../cloudflare/types';
import { nativeCfTransport } from '../native/cloudflareApi';
import { useServerUpdate } from './serverUpdate';
import { useSetup } from './setup';

export type SetupMode = 'setup' | 'update';
export type SetupPhase =
  | 'intro'
  | 'account'
  | 'r2'
  | 'token'
  | 'chooseAccount'
  | 'chooseSubdomain'
  | 'confirmExisting'
  | 'running'
  | 'done'
  | 'error';

export interface CfAccount {
  id: string;
  name: string;
}

interface CloudflareSetupState {
  mode: SetupMode;
  phase: SetupPhase;
  step: SetupStep | null;
  error: SetupErrorCode | null;
  accounts: CfAccount[];
  suggestedSubdomain: string;
  start(mode: SetupMode): void;
  next(): void;
  back(): void;
  submitToken(token: string): Promise<void>;
  pickAccount(id: string): Promise<void>;
  chooseSubdomain(name: string): Promise<void>;
  confirmExisting(): Promise<void>;
  retry(): Promise<void>;
  cancel(): void;
}

// Secrets live in module variables, never in zustand or localStorage.
let token: string | null = null;
let resumeInfo: { baseUrl: string; accessKey?: string } | null = null;
let accountId: string | null = null;
let subdomain: string | null = null;

const FLOW: Record<SetupMode, SetupPhase[]> = {
  setup: ['intro', 'account', 'r2', 'token'],
  update: ['intro', 'token'],
};

function forgetSecrets() {
  token = null;
  resumeInfo = null;
  accountId = null;
  subdomain = null;
}

function suggestSubdomain(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return 'aske-' + [...bytes].map((b) => chars[b % chars.length]).join('');
}

function toErrorCode(e: unknown): SetupErrorCode {
  if (e instanceof SetupError || e instanceof CfError) return e.code;
  if (e instanceof Error && e.message === 'bundle_missing') return 'bundle_missing';
  if (e instanceof Error && e.message === 'network') return 'network';
  return 'unknown';
}

const INITIAL = {
  mode: 'setup' as SetupMode,
  phase: 'intro' as SetupPhase,
  step: null,
  error: null,
  accounts: [] as CfAccount[],
  suggestedSubdomain: '',
};

export const useCloudflareSetup = create<CloudflareSetupState>((set, get) => {
  function fail(e: unknown) {
    if (e instanceof SetupError && e.code === 'not_live_yet') resumeInfo = e.resume ?? null;
    set({ phase: 'error', error: toErrorCode(e), step: null });
  }

  async function finishSetup(baseUrl: string, accessKey: string) {
    await useSetup.getState().connectCloudflare(accessKey, baseUrl);
    resumeInfo = null;
    set({ phase: 'done', step: null });
  }

  async function deployAll(api: CfApi, bundle: WorkerBundle) {
    const common = {
      api,
      bundle,
      accountId: accountId as string,
      onStep: (step: SetupStep) => set({ step }),
    };
    if (get().mode === 'setup') {
      const r = await runSetup({ ...common, subdomain: subdomain ?? '' });
      await finishSetup(r.baseUrl, r.accessKey);
      return;
    }
    const currentBaseUrl = useSetup.getState().config?.cloudflare?.baseUrl ?? '';
    await runUpdate({ ...common, currentBaseUrl });
    set({ phase: 'done', step: null });
    void useServerUpdate.getState().check();
  }

  async function run() {
    if (!token || !accountId) return;
    set({ phase: 'running', step: null, error: null });
    try {
      await deployAll(createCfApi(nativeCfTransport, token), await loadBundle());
    } catch (e) {
      fail(e);
    } finally {
      token = null;
    }
  }

  /** After the account is known: decide what to ask next. */
  async function afterAccount(api: CfApi) {
    if (get().mode === 'update') {
      await run();
      return;
    }
    const existing = await getSubdomain(api, accountId as string);
    if (existing === null) {
      subdomain = null;
      set({ phase: 'chooseSubdomain', suggestedSubdomain: suggestSubdomain() });
    } else if (await scriptExists(api, accountId as string)) {
      set({ phase: 'confirmExisting' });
    } else {
      await run();
    }
  }

  /** In update mode only the account hosting the connected Worker is valid. */
  async function findUpdateAccount(api: CfApi, accounts: CfAccount[]): Promise<string> {
    const current = useSetup.getState().config?.cloudflare?.baseUrl;
    for (const a of accounts) {
      const sub = await getSubdomain(api, a.id);
      if (sub && workerUrl(sub) === current) return a.id;
    }
    throw new SetupError('wrong_account');
  }

  async function guarded(action: () => Promise<void>) {
    try {
      await action();
    } catch (e) {
      token = null;
      fail(e);
    }
  }

  async function verifyAndContinue(value: string) {
    const api = createCfApi(nativeCfTransport, value);
    await verifyToken(api);
    const accounts = await listAccounts(api);
    if (accounts.length === 0) throw new SetupError('no_account');
    set({ accounts });
    if (get().mode === 'update') {
      accountId = await findUpdateAccount(api, accounts);
    } else if (accounts.length > 1) {
      set({ phase: 'chooseAccount' });
      return;
    } else {
      accountId = accounts[0]!.id;
    }
    await afterAccount(api);
  }

  async function resumeWaiting(info: { baseUrl: string; accessKey?: string }) {
    set({ phase: 'running', step: 'waiting', error: null });
    try {
      const bundle = await loadBundle();
      await waitUntilLive(info.baseUrl, bundle.manifest.version);
      if (info.accessKey) await finishSetup(info.baseUrl, info.accessKey);
      else set({ phase: 'done', step: null });
    } catch (e) {
      fail(e);
    }
  }

  return {
    ...INITIAL,

    start(mode) {
      forgetSecrets();
      set({ ...INITIAL, mode });
    },

    next() {
      const flow = FLOW[get().mode];
      const i = flow.indexOf(get().phase);
      if (i >= 0 && i < flow.length - 1) set({ phase: flow[i + 1] });
    },

    back() {
      const flow = FLOW[get().mode];
      const i = flow.indexOf(get().phase);
      if (i > 0) set({ phase: flow[i - 1] });
      else get().cancel();
    },

    async submitToken(value) {
      token = value.trim();
      set({ phase: 'running', step: 'account', error: null });
      await guarded(() => verifyAndContinue(token as string));
    },

    async pickAccount(id) {
      if (!token) return;
      accountId = id;
      await guarded(() => afterAccount(createCfApi(nativeCfTransport, token as string)));
    },

    async chooseSubdomain(name) {
      subdomain = name.trim().toLowerCase();
      await run();
    },

    async confirmExisting() {
      await run();
    },

    async retry() {
      if (get().error === 'not_live_yet' && resumeInfo) {
        await resumeWaiting(resumeInfo);
        return;
      }
      // The token was already discarded: ask for it again.
      set({ phase: 'token', error: null, step: null });
    },

    cancel() {
      forgetSecrets();
      set({ ...INITIAL, mode: get().mode });
      useSetup.getState().closeCloudflareSetup();
    },
  };
});

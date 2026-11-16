// Browser harness: a Google account that always says yes (see vite.config.ts, mode "fakenative").
// window.__fakeGoogle.deny = 'canceled' | 'consent_required' simulates the user saying no.
const w = window as unknown as { __fakeGoogle?: { deny?: string; calls: string[] } };
w.__fakeGoogle ??= { calls: [] };

export const GoogleDrive = {
  async authorize({ interactive }: { interactive: boolean }) {
    const g = w.__fakeGoogle!;
    g.calls.push(`authorize:${interactive}`);
    if (g.deny === 'consent_required' && !interactive)
      throw Object.assign(new Error('Google access needs your confirmation'), {
        code: 'consent_required',
      });
    if (g.deny === 'canceled')
      throw Object.assign(new Error('You closed the Google window'), { code: 'canceled' });
    return { accessToken: 'fake-token', email: 'friend@example.com' };
  },
  async revoke() {
    w.__fakeGoogle!.calls.push('revoke');
  },
};

export type ConnectionProblem = 'noInternet' | 'unreachable' | 'blocked';
export type UrlProbe = (url: string) => Promise<boolean>;

interface DiagnosisDeps {
  probe: UrlProbe;
  hubUrl: string | null;
  online: boolean;
}

/**
 * Finds out why a request to the server failed, without depending on Google
 * (it is unreachable in some countries). The Hub stands in as the "is the
 * internet up" reference.
 */
export async function diagnoseConnection(
  baseUrl: string,
  { probe, hubUrl, online }: DiagnosisDeps,
): Promise<ConnectionProblem> {
  if (!online) return 'noInternet';
  // A static file: /api answers carry a same-origin resource policy that hides them here.
  if (await probe(`${baseUrl}/favicon.svg`)) return 'blocked';
  if (!hubUrl) return 'unreachable';
  return (await probe(`${hubUrl.replace(/\/+$/, '')}/hub/v1/health`))
    ? 'unreachable'
    : 'noInternet';
}

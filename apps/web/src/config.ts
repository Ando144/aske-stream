/** Public GitHub repository: source code, guides and Android app releases. */
export const GITHUB_REPO = 'Ando144/aske-stream';
export const REPO_URL = `https://github.com/${GITHUB_REPO}`;
export const RELEASES_URL = `${REPO_URL}/releases`;

/** The person who made Aske Stream. */
export const AUTHOR = {
  name: 'Andoni Ortiz de Zarate Urruela',
  github: 'https://github.com/Ando144',
  website: 'https://ando144.github.io',
};

/**
 * Google OAuth "Web application" client id, used by the web app to reach
 * Google Drive (the Android app is recognised by its package name and
 * signing key instead). A client id is public by design: it is not a secret.
 * Empty = Google Drive is shown as "coming soon" on the web.
 * Paste it between the quotes below (VITE_GOOGLE_CLIENT_ID overrides it, for
 * tests). See docs/google-drive.md.
 */
export const GOOGLE_WEB_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

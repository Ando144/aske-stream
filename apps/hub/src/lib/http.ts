import type { HubErrorCode } from '@aske/shared/hub';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** An error that maps directly to an HTTP response `{ error, message }`. */
export class HubHttpError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: HubErrorCode,
    message: string,
  ) {
    super(message);
  }
}

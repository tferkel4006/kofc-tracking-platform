// How the web app's data driver sends email (Sprint 6Z-Engine-Upgrade): to the portal's own server route
// (app/api/notifications/email), which holds the SendGrid key. The request leaves the browser with the key placeholder;
// the route rebuilds it. While the server only simulates the send, the request is also printed here as before, so the
// demo's setup and reset codes still show in the browser console.
import { logSendGridRequest, type SendGridMailRequest } from '@kofc/shared';

export const EMAIL_ROUTE = '/api/notifications/email';

export async function sendEmailViaServer(request: SendGridMailRequest): Promise<void> {
  const res = await fetch(EMAIL_ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: request.body }),
  }).catch(() => null);
  const body = (await res?.json().catch(() => null)) as { sent?: boolean } | null;
  if (!body?.sent) await logSendGridRequest(console.log)(request);
}

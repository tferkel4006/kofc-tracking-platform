// How the web app's data driver posts a Supreme report: to the portal's own server route (app/api/supreme/alchemer),
// which holds the Alchemer credentials. Only the survey id and the answers leave the browser; the route rebuilds the
// request itself, so no credential or URL ever comes from the client.
import type { AlchemerRequest, AlchemerResponse } from '@kofc/shared';

export const ALCHEMER_ROUTE = '/api/supreme/alchemer';

export async function postAlchemerViaServer(request: AlchemerRequest): Promise<AlchemerResponse> {
  const res = await fetch(ALCHEMER_ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ surveyId: request.surveyId, answers: request.answers }),
  });
  const body = (await res.json().catch(() => null)) as Partial<AlchemerResponse> | null;
  if (!res.ok || !body?.result_ok) {
    return { result_ok: false, message: body?.message ?? `The report server answered HTTP ${res.status}.` };
  }
  return { result_ok: true, message: body.message };
}

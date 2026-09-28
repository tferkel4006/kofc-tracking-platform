// POST /api/supreme/alchemer - the server side of the Supreme Compliance Center's "Transmit" button (Sprint 5T).
//
// The portal's data driver runs in the browser, so it must never hold the Alchemer API credentials: anything a client
// component reads from process.env is baked into the public JavaScript bundle. They live here instead, read on the
// server from ALCHEMER_API_KEY (Alchemer's api_token) and ALCHEMER_API_SECRET (api_token_secret).
//
// SIMULATION ONLY. The portal has no server-side sessions yet, so this route cannot tell who is calling it; forwarding
// to Alchemer from here would let anyone file answers to the Supreme Council under the council's account. Until the
// remote driver brings authenticated sessions, the route validates the payload, logs the request it would send (with
// the credentials redacted) and answers as Alchemer would on success. It only ever talks to api.alchemer.com through
// buildAlchemerRequest, never to a caller-supplied URL.
import { NextResponse } from 'next/server';
import { ALL_ALCHEMER_SHORTNAMES, buildAlchemerRequest, BusinessRuleError, cleanAlchemerSurveyId, describeError } from '@kofc/shared';

const invalid = (message: string) => new BusinessRuleError('INVALID_INPUT', message);

/** Longest answer value accepted; the compiled answers are numbers and short period labels. */
const MAX_ANSWER_LENGTH = 200;

function cleanAnswers(value: unknown): Record<string, string | number> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw invalid('answers must be an object.');
  const out: Record<string, string | number> = {};
  for (const [key, answer] of Object.entries(value)) {
    if (!ALL_ALCHEMER_SHORTNAMES.has(key)) throw invalid(`Unknown question shortname "${key}".`);
    if (typeof answer === 'number' && Number.isFinite(answer)) out[key] = answer;
    else if (typeof answer === 'string' && answer.length <= MAX_ANSWER_LENGTH) out[key] = answer;
    else throw invalid(`The answer to "${key}" must be a number or a short text.`);
  }
  if (Object.keys(out).length === 0) throw invalid('At least one answer is required.');
  return out;
}

export async function POST(req: Request) {
  let surveyId: string;
  let answers: Record<string, string | number>;
  try {
    const payload = (await req.json()) as { surveyId?: unknown; answers?: unknown };
    surveyId = cleanAlchemerSurveyId(payload?.surveyId);
    answers = cleanAnswers(payload?.answers);
  } catch (err) {
    return NextResponse.json({ result_ok: false, message: describeError(err) }, { status: 400 });
  }

  const credentialsConfigured = Boolean(process.env.ALCHEMER_API_KEY && process.env.ALCHEMER_API_SECRET);
  // Built with the placeholder credentials, so the log never carries the real pair.
  console.log('[alchemer] simulated post:', JSON.stringify(buildAlchemerRequest(surveyId, answers), null, 2));
  return NextResponse.json({ result_ok: true, simulated: true, credentialsConfigured });
}

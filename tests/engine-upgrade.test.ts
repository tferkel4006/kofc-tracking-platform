// Sprint 6Z-Engine-Upgrade: the centralized state machine engine (packages/shared/src/workflow.ts) and the portal's
// server session layer (apps/web/services/server, app/api/auth/session and the routes it now guards).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  availableActions,
  BusinessRuleError,
  canTransition,
  defineWorkflow,
  EVENT_PHASE_WORKFLOW,
  eventPhase,
  EXPENSE_WORKFLOW,
  INTAKE_SESSION_WORKFLOW,
  isLegalTransition,
  memberOnboardingState,
  nextExpenseStatus,
  nextIntakeSessionStatus,
  nextOnboardingState,
  ONBOARDING_WORKFLOW,
  UNREGISTERED_PASSWORD,
} from '@kofc/shared';
import {
  PORTAL_SESSION_COOKIE,
  PORTAL_SESSION_TTL_SECONDS,
  readCookie,
  sessionActor,
  sessionClaimsFor,
  sessionCookieHeader,
  signSessionToken,
  SignInThrottle,
  verifySessionToken,
} from '../apps/web/services/server/session-token';
import { liveDriveCredentials, liveSendGridKey, portalSessionSecret } from '../apps/web/services/server/secrets';
import { signInOnServer } from '../apps/web/services/server/session';
import { POST as sessionPost, GET as sessionGet, DELETE as sessionDelete } from '../apps/web/app/api/auth/session/route';
import { POST as drivePost } from '../apps/web/app/api/drive-vault/route';
import { GET as driveMediaGet } from '../apps/web/app/api/drive-vault/media/route';
import { POST as alchemerPost } from '../apps/web/app/api/supreme/alchemer/route';
import { POST as rosterPost } from '../apps/web/app/api/supreme/roster/route';
import { POST as emailPost } from '../apps/web/app/api/notifications/email/route';

const DEV_PASSWORD = 'dev-pass-secure-9912';
const ADMIN = 'testadmin@kofc.org';
const MEMBER = 'testmember@kofc.org';

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (err) {
    return err instanceof BusinessRuleError ? err.code : `not a rule error: ${String(err)}`;
  }
  return undefined;
}

// ---- the workflow engine ---------------------------------------------------------------------------------------------

describe('defineWorkflow', () => {
  it('accepts the four built-in workflows', () => {
    for (const wf of [EXPENSE_WORKFLOW, ONBOARDING_WORKFLOW, EVENT_PHASE_WORKFLOW, INTAKE_SESSION_WORKFLOW]) expect(Object.isFrozen(wf)).toBe(true);
  });

  it('refuses a malformed definition when it is declared', () => {
    const base = { name: 'T', states: ['A', 'B'] as const, initial: 'A' as const, terminal: ['B'] as const, conflictCode: 'ILLEGAL_STATE_TRANSITION' as const };
    expect(() => defineWorkflow({ ...base, transitions: { go: { from: ['A'], to: 'C' as 'B' } } })).toThrow(/undeclared state "C"/);
    expect(() => defineWorkflow({ ...base, transitions: { go: { from: ['A'], to: 'B' }, back: { from: ['B'], to: 'A' } } })).toThrow(/terminal state "B"/);
    expect(() => defineWorkflow({ ...base, terminal: [], transitions: { go: { from: ['A'], to: 'B' } } })).toThrow(/"B" has no action/);
    expect(() => defineWorkflow({ ...base, initial: 'Z' as 'A', transitions: { go: { from: ['A'], to: 'B' } } })).toThrow(/initial state/);
    expect(() => defineWorkflow({ ...base, transitions: { go: { from: [], to: 'B' } } })).toThrow(/starts from no state/);
  });
});

describe('expense voucher workflow', () => {
  it('walks the legal path Draft -> Submitted -> Approved -> Reimbursed', () => {
    expect(nextExpenseStatus(null, 'saveDraft')).toBe('Draft');
    expect(nextExpenseStatus(null, 'submit')).toBe('Submitted');
    expect(nextExpenseStatus('Draft', 'submit', 4)).toBe('Submitted');
    expect(nextExpenseStatus('Submitted', 'return', 4)).toBe('Draft');
    expect(nextExpenseStatus('Submitted', 'approve', 4)).toBe('Approved');
    expect(nextExpenseStatus('Approved', 'reimburse', 4)).toBe('Reimbursed');
  });

  it('bars every illegal jump with EXPENSE_STATUS_CONFLICT', () => {
    expect(code(() => nextExpenseStatus('Draft', 'approve', 4))).toBe('EXPENSE_STATUS_CONFLICT');
    expect(code(() => nextExpenseStatus('Draft', 'reimburse', 4))).toBe('EXPENSE_STATUS_CONFLICT');
    expect(code(() => nextExpenseStatus('Submitted', 'reimburse', 4))).toBe('EXPENSE_STATUS_CONFLICT');
    expect(code(() => nextExpenseStatus('Submitted', 'submit', 4))).toBe('EXPENSE_STATUS_CONFLICT');
    expect(code(() => nextExpenseStatus('Approved', 'return', 4))).toBe('EXPENSE_STATUS_CONFLICT');
    for (const action of ['saveDraft', 'submit', 'return', 'approve', 'reimburse'] as const) {
      expect(code(() => nextExpenseStatus('Reimbursed', action, 4))).toBe('EXPENSE_STATUS_CONFLICT');
    }
  });

  it('refuses a corrupt status rather than guessing', () => {
    expect(() => nextExpenseStatus('Paid', 'reimburse', 9)).toThrow(/unknown state "Paid"/);
    expect(canTransition(EXPENSE_WORKFLOW, 'Paid', 'reimburse')).toBe(false);
  });

  it('names the open actions and the legal edges', () => {
    expect(availableActions(EXPENSE_WORKFLOW, 'Submitted')).toEqual(['return', 'approve']);
    expect(availableActions(EXPENSE_WORKFLOW, 'Reimbursed')).toEqual([]);
    expect(isLegalTransition(EXPENSE_WORKFLOW, 'Approved', 'Reimbursed')).toBe(true);
    expect(isLegalTransition(EXPENSE_WORKFLOW, 'Draft', 'Reimbursed')).toBe(false);
  });
});

describe('member onboarding workflow', () => {
  it('reads the account state from the password and the setup code', () => {
    expect(memberOnboardingState(UNREGISTERED_PASSWORD, false)).toBe('Provisioned');
    expect(memberOnboardingState(UNREGISTERED_PASSWORD, true)).toBe('Invited');
    expect(memberOnboardingState('a'.repeat(64), true)).toBe('Registered');
  });

  it('allows invite -> register -> reset and nothing out of order', () => {
    expect(nextOnboardingState('Provisioned', 'issueSetupCode')).toBe('Invited');
    expect(nextOnboardingState('Invited', 'issueSetupCode')).toBe('Invited');
    expect(nextOnboardingState('Invited', 'register')).toBe('Registered');
    expect(nextOnboardingState('Registered', 'resetPassword')).toBe('Registered');
    expect(code(() => nextOnboardingState('Provisioned', 'register', 3))).toBe('ILLEGAL_STATE_TRANSITION');
    expect(code(() => nextOnboardingState('Registered', 'issueSetupCode', 3))).toBe('ILLEGAL_STATE_TRANSITION');
    expect(code(() => nextOnboardingState('Registered', 'register', 3))).toBe('ILLEGAL_STATE_TRANSITION');
    expect(code(() => nextOnboardingState('Invited', 'resetPassword', 3))).toBe('ILLEGAL_STATE_TRANSITION');
  });
});

describe('event tracking workflow', () => {
  const event = { StartDate: '2026-10-10', EndDate: '2026-10-11' };

  it('reads the phase from the calendar', () => {
    expect(eventPhase(event, new Date(2026, 9, 9, 23, 59))).toBe('Upcoming');
    expect(eventPhase(event, new Date(2026, 9, 10, 0, 0))).toBe('In Progress');
    expect(eventPhase(event, new Date(2026, 9, 11, 23, 0))).toBe('In Progress');
    expect(eventPhase(event, new Date(2026, 9, 12))).toBe('Completed');
    expect(eventPhase({ StartDate: '2026-10-10 09:00:00', EndDate: '2026-10-10 13:00:00' }, new Date(2026, 9, 10, 20))).toBe('In Progress');
  });

  it('never moves a completed event back', () => {
    expect(availableActions(EVENT_PHASE_WORKFLOW, 'Completed')).toEqual([]);
    expect(isLegalTransition(EVENT_PHASE_WORKFLOW, 'In Progress', 'Upcoming')).toBe(false);
  });

  it('opens and closes the gate intake, repeats included', () => {
    expect(nextIntakeSessionStatus(undefined, 'Active', 1)).toBe('Active');
    expect(nextIntakeSessionStatus('Active', 'Active', 1)).toBe('Active');
    expect(nextIntakeSessionStatus('Active', 'Inactive', 1)).toBe('Inactive');
    expect(code(() => nextIntakeSessionStatus('Paused', 'Active', 1))).toBe('ILLEGAL_STATE_TRANSITION');
  });
});

// ---- session tokens --------------------------------------------------------------------------------------------------

const SECRET = 'x'.repeat(40);
const NOW = new Date('2026-10-07T12:00:00Z');
const adminUser = {
  credentialId: 1,
  memberId: 2,
  councilId: 1,
  username: ADMIN,
  firstName: 'Test',
  lastName: 'Admin',
  memberType: 'Admin' as const,
  roles: [],
  isOfficer: false,
  isBudgetDirector: false,
};

describe('portal session tokens', () => {
  it('round-trips signed claims', async () => {
    const claims = sessionClaimsFor(adminUser, true, NOW);
    const token = await signSessionToken(claims, SECRET);
    expect(await verifySessionToken(token, SECRET, NOW)).toEqual(claims);
    expect(sessionActor(claims)).toMatchObject({ memberId: 2, councilId: 1, memberType: 'Admin', active: true });
  });

  it('refuses a forged, tampered, foreign or expired token', async () => {
    const token = await signSessionToken(sessionClaimsFor(adminUser, true, NOW), SECRET);
    const [body, sig] = token.split('.');
    const forgedBody = btoa(JSON.stringify({ ...sessionClaimsFor(adminUser, true, NOW), memberType: 'Super Admin' })).replace(/=+$/, '');
    expect(await verifySessionToken(`${forgedBody}.${sig}`, SECRET, NOW)).toBeNull();
    expect(await verifySessionToken(`${body}.${sig.slice(0, -2)}AA`, SECRET, NOW)).toBeNull();
    expect(await verifySessionToken(token, 'y'.repeat(40), NOW)).toBeNull();
    expect(await verifySessionToken(token, SECRET, new Date(NOW.getTime() + PORTAL_SESSION_TTL_SECONDS * 1000))).toBeNull();
    expect(await verifySessionToken('garbage', SECRET, NOW)).toBeNull();
    expect(await verifySessionToken(null, SECRET, NOW)).toBeNull();
  });

  it('writes an HttpOnly, SameSite=Strict cookie scoped to /api and reads it back', () => {
    const header = sessionCookieHeader('abc.def', true);
    expect(header).toBe(`${PORTAL_SESSION_COOKIE}=abc.def; Path=/api; HttpOnly; SameSite=Strict; Secure`);
    expect(sessionCookieHeader(null, false)).toContain('Max-Age=0');
    expect(readCookie(`theme=dark; ${PORTAL_SESSION_COOKIE}=abc.def`, PORTAL_SESSION_COOKIE)).toBe('abc.def');
    expect(readCookie(null, PORTAL_SESSION_COOKIE)).toBeNull();
  });

  it('locks a username after five failures in 15 minutes', () => {
    const t = new SignInThrottle();
    for (let i = 0; i < 5; i++) t.fail('a', 1000 * i);
    expect(t.isLocked('a', 5000)).toBe(true);
    expect(t.isLocked('a', 15 * 60 * 1000 + 5000)).toBe(false);
    t.fail('b', 0);
    t.clear('b');
    expect(t.isLocked('b', 0)).toBe(false);
  });
});

describe('server-held secrets', () => {
  it('turns the vault and SendGrid live only with the switch on', () => {
    const drive = { GOOGLE_DRIVE_CLIENT_EMAIL: 'svc@x.iam.gserviceaccount.com', GOOGLE_DRIVE_PRIVATE_KEY: 'k', GOOGLE_DRIVE_SHARED_DRIVE_ID: 'd' };
    expect(liveDriveCredentials(drive)).toBeNull();
    expect(liveDriveCredentials({ ...drive, DRIVE_VAULT_LIVE: '1' })?.sharedDriveId).toBe('d');
    expect(liveSendGridKey({ SENDGRID_API_KEY: 'SG.k' })).toBeNull();
    expect(liveSendGridKey({ SENDGRID_API_KEY: 'SG.k', SENDGRID_LIVE: '1' })).toBe('SG.k');
  });

  it('uses PORTAL_SESSION_SECRET, or a random per-process key when it is missing or short', () => {
    expect(portalSessionSecret({ PORTAL_SESSION_SECRET: SECRET })).toBe(SECRET);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const generated = portalSessionSecret({ PORTAL_SESSION_SECRET: 'short' });
    expect(generated).toMatch(/^[0-9a-f]{64}$/);
    expect(portalSessionSecret({})).toBe(generated);
    warn.mockRestore();
  });

  it('is never imported by browser code', () => {
    const webRoot = join(__dirname, '../apps/web');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name === '.next') continue;
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name)) {
          const rel = relative(webRoot, path).replace(/\\/g, '/');
          const serverSide = rel.startsWith('app/api/') || rel.startsWith('services/server/');
          const text = readFileSync(path, 'utf8');
          if (!serverSide && /from ['"][^'"]*services\/server\/|from ['"]\.\/server\//.test(text)) offenders.push(rel);
          if (!serverSide && /process\.env\.(?!NEXT_PUBLIC_|NODE_ENV)/.test(text) && rel !== 'services/google-drive.ts') offenders.push(`${rel} (process.env)`);
        }
      }
    };
    walk(webRoot);
    expect(offenders).toEqual([]);
  });
});

// ---- the routes ------------------------------------------------------------------------------------------------------

async function cookieFor(username: string): Promise<string> {
  const outcome = await signInOnServer(username, DEV_PASSWORD);
  if (!outcome.ok) throw new Error(`${username} could not sign in: ${outcome.message}`);
  return outcome.cookie.split(';')[0];
}

const jsonRequest = (url: string, body: unknown, cookie?: string) =>
  new Request(`http://localhost${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });

describe('/api/auth/session', () => {
  it('signs in on the server, reports the session and signs out', async () => {
    const res = await sessionPost(jsonRequest('/api/auth/session', { username: ADMIN, password: DEV_PASSWORD }));
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie')!;
    expect(setCookie).toMatch(/HttpOnly; SameSite=Strict/);
    const me = await sessionGet(new Request('http://localhost/api/auth/session', { headers: { cookie: setCookie.split(';')[0] } }));
    expect(await me.json()).toMatchObject({ signedIn: true, memberType: 'Admin' });
    expect((await sessionGet(new Request('http://localhost/api/auth/session'))).status).toBe(401);
    expect((await sessionDelete()).headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('refuses a wrong password and then throttles the username', async () => {
    const wrong = () => sessionPost(jsonRequest('/api/auth/session', { username: 'throttle-me@kofc.org', password: 'nope' }));
    for (let i = 0; i < 5; i++) expect((await wrong()).status).toBe(401);
    expect((await wrong()).status).toBe(429);
    expect((await sessionPost(jsonRequest('/api/auth/session', { username: '', password: '' }))).status).toBe(400);
  });
});

describe('guarded routes', () => {
  afterEach(() => vi.restoreAllMocks());

  const upload = (cookie?: string) => {
    const form = new FormData();
    form.set('kind', 'minutes');
    form.set('file', new File(['minutes'], 'minutes.pdf', { type: 'application/pdf' }));
    return new Request('http://localhost/api/drive-vault', { method: 'POST', body: form, headers: cookie ? { cookie } : {} });
  };

  it('Drive vault: 401 without a session, 403 for a member, 503 for an Admin while the vault is off', async () => {
    expect((await drivePost(upload())).status).toBe(401);
    expect((await drivePost(upload(await cookieFor(MEMBER)))).status).toBe(403);
    const res = await drivePost(upload(await cookieFor(ADMIN)));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ archived: false });
  });

  it('Drive media scan: the same gate', async () => {
    const get = (cookie?: string) => driveMediaGet(new Request('http://localhost/api/drive-vault/media?folder=Fish%20Fry', { headers: cookie ? { cookie } : {} }));
    expect((await get()).status).toBe(401);
    expect((await get(await cookieFor(MEMBER))).status).toBe(403);
    expect((await get(await cookieFor(ADMIN))).status).toBe(503);
  });

  it('Supreme Alchemer sync: leadership only', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const body = { surveyId: '1234567', answers: {} };
    expect((await alchemerPost(jsonRequest('/api/supreme/alchemer', body))).status).toBe(401);
    expect((await alchemerPost(jsonRequest('/api/supreme/alchemer', body, await cookieFor(MEMBER)))).status).toBe(403);
    // The Admin passes the gate and reaches the payload check.
    expect((await alchemerPost(jsonRequest('/api/supreme/alchemer', body, await cookieFor(ADMIN)))).status).toBe(400);
  });

  it("Supreme roster: only the council's Admin gets the server's reading", async () => {
    const csv = 'Member Number,First Name,Last Name,Email,Date Joined\n5550001,Luke,Newman,luke@example.org,2026-09-01\n';
    const admin = await cookieFor(ADMIN);
    const me = await (await sessionGet(new Request('http://localhost/api/auth/session', { headers: { cookie: admin } }))).json();
    expect((await rosterPost(jsonRequest('/api/supreme/roster', { councilId: me.councilId, csv }))).status).toBe(401);
    expect((await rosterPost(jsonRequest('/api/supreme/roster', { councilId: me.councilId, csv }, await cookieFor(MEMBER)))).status).toBe(403);
    expect((await rosterPost(jsonRequest('/api/supreme/roster', { councilId: me.councilId + 1000, csv }, admin))).status).toBe(403);
    const ok = await rosterPost(jsonRequest('/api/supreme/roster', { councilId: me.councilId, csv }, admin));
    expect(ok.status).toBe(200);
    expect((await ok.json()).rows).toEqual([expect.objectContaining({ MemberNumber: 5550001, Email: 'luke@example.org' })]);
  });

  it('email: simulated without the live switch, and never relays more than one message to one address', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const mail = {
      personalizations: [{ to: [{ email: 'luke@example.org' }] }],
      from: { email: 'council@kofc.org' },
      subject: 'Welcome',
      content: [{ type: 'text/plain', value: 'Hello' }],
    };
    const res = await emailPost(jsonRequest('/api/notifications/email', { body: mail }));
    expect(await res.json()).toEqual({ sent: false, simulated: true });
    expect(String(log.mock.calls[0]?.[1])).toContain('[SENDGRID_API_KEY]');
    const two = { ...mail, personalizations: [{ to: [{ email: 'a@x.org' }, { email: 'b@x.org' }] }] };
    expect((await emailPost(jsonRequest('/api/notifications/email', { body: two }))).status).toBe(400);
  });
});

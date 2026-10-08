// POST /api/finance/form-1295 - compiles the Semiannual Trustee Audit report (Sprint 6N) as a print-ready PDF in the layout
// of Form 1295. Takes JSON { council: { id, number, name }, workspace } (the desk finance.getTrusteeAudit returned), runs
// the ReportLab script scripts/form_1295_report.py on the server, saves the result as generated/Form_1295_Audit_Report.pdf
// and answers with the PDF (application/pdf).
//
// The books are read by the executive dashboard's audience, so the route admits a portal session that may read the
// council's general ledger (mayReadGeneralLedger): 401 without one, 403 otherwise. 400 for a body that is not an audit
// desk; 503 when Python or ReportLab is missing on the server (pip install -r scripts/requirements.txt). The interpreter
// is FORM_1295_PYTHON, else `python` on Windows and `python3` elsewhere. The script is run without a shell and the desk
// is handed over in a temporary file, never on the command line.
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { NextResponse } from 'next/server';
import { cleanForm1295Payload, describeError, mayReadGeneralLedger } from '@kofc/shared';
import { requirePortalSession } from '@/services/server/session';

export const runtime = 'nodejs';

/** The repository root: the nearest folder up from the server's working directory that holds Schema.sql. */
function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, 'Schema.sql')) && existsSync(join(dir, 'scripts'))) return dir;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return process.cwd();
}

function runScript(python: string, script: string, input: string, output: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(python, [script, '--input', input, '--output', output], { timeout: 60_000, windowsHide: true }, (err, _stdout, stderr) => {
      if (err) reject(Object.assign(err, { stderr: String(stderr ?? '') }));
      else resolve();
    });
  });
}

export async function POST(req: Request) {
  const session = await requirePortalSession(req, () => true);
  if ('denied' in session) return session.denied;

  let payload;
  try {
    payload = cleanForm1295Payload(await req.json());
  } catch (err) {
    return NextResponse.json({ message: describeError(err) }, { status: 400 });
  }
  if (!mayReadGeneralLedger(session.actor, payload.council.id)) {
    return NextResponse.json({ message: "Only the council's officers, Admins and Super Admins can print its Trustee audit." }, { status: 403 });
  }

  const root = repoRoot();
  const script = join(root, 'scripts', 'form_1295_report.py');
  const target = join(root, 'generated', 'Form_1295_Audit_Report.pdf');
  const python = process.env.FORM_1295_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  const work = await mkdtemp(join(tmpdir(), 'form-1295-'));
  try {
    const input = join(work, 'audit.json');
    const output = join(work, 'Form_1295_Audit_Report.pdf');
    await writeFile(input, JSON.stringify({ ...payload, generatedAt: new Date().toISOString().slice(0, 19).replace('T', ' ') }), 'utf8');
    try {
      await runScript(python, script, input, output);
    } catch (err) {
      const detail = (err as { stderr?: string }).stderr || describeError(err);
      console.error('[form-1295] report script failed:', detail);
      const missing = /No module named|ENOENT|not recognized|not found/i.test(detail);
      return NextResponse.json(
        {
          message: missing
            ? 'The server cannot compile the report: Python with ReportLab is not installed (pip install -r scripts/requirements.txt).'
            : 'The report could not be compiled. Try again, or ask an Admin to check the server log.',
        },
        { status: missing ? 503 : 500 },
      );
    }
    const pdf = await readFile(output);
    await copyFile(output, target).catch((err) => console.error('[form-1295] could not save generated/Form_1295_Audit_Report.pdf:', describeError(err)));
    console.log(`[form-1295] member ${session.claims.memberId} compiled the ${payload.workspace.periodLabel} audit of council ${payload.council.id}`);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="Form_1295_Audit_Report.pdf"',
        'Cache-Control': 'no-store',
      },
    });
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => undefined);
  }
}

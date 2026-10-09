'use client';
// Council Artifacts (Sprint 6Z as "Bulletins", renamed in the Sprint 6L Extension): a card wall of the council's files already filed in Google Drive - meeting flyers and minutes
// (Meeting.GoogleDriveFlyerURL, GoogleDriveMinutesURL, or a Drive vault id in MinutesURL) and event photo albums
// (Event.PhotoGalleryURL) - newest first (bulletinCards). Each card opens the file in Google Drive in a new tab;
// Drive's own sharing settings still decide who can open it. Open to every member of the council.
// Sprint 6R: one unified drawer (unifiedArtifacts) also lists the compliance reports the portal compiles itself - the
// Form 1295 Semiannual Trustee Audit report of every locked audit period (complianceReportEntries). Those cards show only
// to readers of the books (canReadGeneralLedger, the same audience /api/finance/form-1295 admits); selecting one compiles
// the PDF again from the locked desk and downloads it.
import { useState } from 'react';
import {
  bulletinCards,
  canReadGeneralLedger,
  complianceReportEntries,
  describeError,
  unifiedArtifacts,
  type ArtifactEntry,
  type ArtifactKind,
} from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { cx, Empty, Notice, PageTitle, Pill } from '@/components/ui';
import { formatFullDate } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';
import { compileForm1295 } from '@/services/form-1295-transport';

const KINDS: readonly ArtifactKind[] = ['Flyer', 'Minutes', 'Photo album', 'Form 1295 audit'];
const KIND_ICON: Record<ArtifactKind, string> = { Flyer: '📣', Minutes: '📝', 'Photo album': '📷', 'Form 1295 audit': '🧾' };

const cardLook = 'flex h-full w-full flex-col gap-2 rounded border-2 border-navy border-t-8 bg-white p-4 text-left hover:underline';

function CardHeader({ entry }: { entry: ArtifactEntry }) {
  return (
    <>
      <span className="flex items-center justify-between gap-2">
        <Pill tone="outline">
          <span aria-hidden="true">{KIND_ICON[entry.kind]} </span>
          {entry.kind}
        </Pill>
        <span className="text-xs text-muted">{formatFullDate(entry.date)}</span>
      </span>
      <span className="font-serif text-lg font-bold">{entry.title}</span>
      <span className="text-xs font-bold uppercase tracking-wide text-muted">{entry.source === 'drive' ? 'Google Drive file' : 'System compliance report'}</span>
    </>
  );
}

function ArtifactsBoard() {
  const user = useUser();
  const [kind, setKind] = useState<ArtifactKind | 'all'>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const readsBooks = canReadGeneralLedger(user, user.councilId);
  const cards = useLoad(async () => {
    const [meetings, events, audits] = await Promise.all([
      // Every meeting of the council, past ones included.
      db.meetings.listUpcoming(user.councilId, { fromDate: '1900-01-01' }),
      db.events.listByCouncil(user.councilId),
      readsBooks ? db.finance.listTrusteeAudits(user.memberId, user.councilId) : Promise.resolve([]),
    ]);
    return unifiedArtifacts(bulletinCards(meetings, events), complianceReportEntries(audits));
  }, [user.councilId, user.memberId, readsBooks]);
  const all = cards.data ?? [];
  const kinds = KINDS.filter((k) => k !== 'Form 1295 audit' || readsBooks);
  const shown = kind === 'all' ? all : all.filter((c) => c.kind === kind);

  const download = async (entry: Extract<ArtifactEntry, { source: 'system' }>) => {
    setBusy(entry.key);
    setMessage(null);
    try {
      const [workspace, council] = await Promise.all([
        db.finance.getTrusteeAudit(user.memberId, user.councilId, entry.audit.fiscalYear, entry.audit.period),
        db.councils.get(user.councilId),
      ]);
      if (!council) throw new Error('This council no longer exists.');
      const pdf = await compileForm1295({ council: { id: council.id, number: council.CouncilNumber, name: council.CouncilName }, workspace });
      const url = URL.createObjectURL(pdf);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Form_1295_Audit_${entry.audit.fiscalYear}_${entry.audit.period}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMessage({ tone: 'info', text: `The ${entry.title} report is downloading.` });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageTitle>Council Artifacts</PageTitle>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          One drawer for the council&apos;s files: flyers, minutes and photo albums filed in Google Drive open in a new tab
          {readsBooks ? ', and the compliance reports the portal compiles, such as the Form 1295 audits, download as PDF' : ''}.
        </p>
        <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
          {(['all', ...kinds] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={cx('rounded border-2 border-navy px-3 py-1 text-sm font-bold', kind === k ? 'bg-navy text-white' : 'bg-white text-navy')}
            >
              {k === 'all' ? `All (${all.length})` : `${k} (${all.filter((c) => c.kind === k).length})`}
            </button>
          ))}
        </div>
        {cards.error ? <Notice tone="error">{cards.error}</Notice> : null}
        {message ? (
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        ) : null}
        {cards.loading ? null : shown.length === 0 ? (
          <Empty>
            No artifacts yet. Link a flyer or minutes to a meeting, archive event photos to the Drive vault
            {readsBooks ? ', or have the Trustees sign a semiannual audit' : ''}.
          </Empty>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((c) => (
              <li key={c.key}>
                {c.source === 'drive' ? (
                  <a href={c.href} target="_blank" rel="noopener noreferrer" className={cx(cardLook, 'border-t-gold')}>
                    <CardHeader entry={c} />
                    <span className="mt-auto text-sm font-bold">
                      Open in Google Drive <span aria-hidden="true">↗</span>
                      <span className="sr-only"> (opens in a new tab)</span>
                    </span>
                  </a>
                ) : (
                  <button type="button" disabled={busy !== null} onClick={() => void download(c)} className={cx(cardLook, 'border-t-navy disabled:opacity-60')}>
                    <CardHeader entry={c} />
                    <span className="mt-auto text-sm font-bold">{busy === c.key ? 'Compiling the PDF…' : 'Download PDF'}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export default function BulletinsPage() {
  return (
    <RequireArea area="resources/bulletins">
      <ArtifactsBoard />
    </RequireArea>
  );
}

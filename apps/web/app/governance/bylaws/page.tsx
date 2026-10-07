'use client';
// Council Bylaws Data Vault (Sprint 6Z): the signed-in member's council bylaws (Council.BylawsMarkdown), read by every
// member. The council's meeting keepers - its Admins and Grand Knight, and any Super Admin (canEditBylaws) - edit them
// in a high-contrast markdown panel with a live preview, saved by councils.setBylaws.
// Under the text, the Parliamentary Engine Feed lists the clauses exactly as bylawsTokenFeed hands them to the Phase 4
// parliamentary engines: one id per article and section ('A2.S3'), so a motion or ruling can cite a clause.
import { useState } from 'react';
import { BYLAWS_MAX_LENGTH, bylawsTokenFeed, canEditBylaws, councilLabel, describeError, type Council } from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { Markdown } from '@/components/Markdown';
import { Button, Empty, Field, Notice, PageTitle, Panel, Table, Td, Textarea } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const STARTER = `# Article I - Name and Purpose

## Section 1 - Name
This council is known as ...

## Section 2 - Purpose
...

# Article II - Officers

## Section 1 - Elected officers
...
`;

const formatSaved = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }) : 'Never saved';

function EngineFeed({ council }: { council: Council }) {
  const feed = bylawsTokenFeed(council);
  return (
    <Panel title="Parliamentary engine feed">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          The parliamentary engines read the bylaws as numbered clauses. Each article heading (#) and section heading (##) starts a new clause. Cite a clause by
          its id.
        </p>
        <p className="text-sm font-bold">
          {feed.clauseCount} clauses · {feed.wordCount.toLocaleString('en-US')} words · format {feed.format}
        </p>
        {feed.clauseCount === 0 ? (
          <Empty>No clauses yet.</Empty>
        ) : (
          <Table head={['Clause id', 'Heading', 'Words']} caption="Bylaws clauses as the parliamentary engines read them">
            {feed.clauses.map((c) => (
              <tr key={c.id}>
                <Td className="font-bold">{c.id}</Td>
                <Td>{c.path.join(' › ') || '(Preamble)'}</Td>
                <Td>{c.wordCount}</Td>
              </tr>
            ))}
          </Table>
        )}
        <details className="rounded border-2 border-navy">
          <summary className="cursor-pointer px-3 py-2 text-sm font-bold">Show the engine feed as JSON</summary>
          <pre className="max-h-96 overflow-auto border-t border-line p-3 text-xs">{JSON.stringify(feed, null, 2)}</pre>
        </details>
      </div>
    </Panel>
  );
}

function BylawsVault() {
  const user = useUser();
  const council = useLoad(() => db.councils.get(user.councilId), [user.councilId]);
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const mayEdit = canEditBylaws(user, user.councilId);
  const row = council.data;
  const text = row?.BylawsMarkdown ?? '';

  const save = async () => {
    if (draft === null || !row) return;
    setSaving(true);
    setMessage(null);
    try {
      await db.councils.setBylaws(user.memberId, row.id, draft);
      await council.reload();
      setDraft(null);
      setMessage({ tone: 'info', text: 'The bylaws are saved.' });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageTitle>Council Bylaws Data Vault</PageTitle>
      <div className="flex flex-col gap-4">
        {council.error ? <Notice tone="error">{council.error}</Notice> : null}
        {message ? (
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        ) : null}
        {row ? (
          <>
            <Panel
              title={`Bylaws of ${councilLabel(row)}`}
              actions={
                mayEdit && draft === null ? (
                  <Button variant="gold" onClick={() => setDraft(text || STARTER)}>
                    Edit bylaws
                  </Button>
                ) : null
              }
            >
              <p className="mb-3 text-sm text-muted">Last saved: {formatSaved(row.BylawsUpdatedAt)}</p>
              {draft !== null ? (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <Field
                    label="Bylaws text"
                    hint={`Start an article with "# " and a section with "## ". ${draft.length.toLocaleString('en-US')} of ${BYLAWS_MAX_LENGTH.toLocaleString('en-US')} characters.`}
                  >
                    {(id) => (
                      <Textarea
                        id={id}
                        value={draft}
                        maxLength={BYLAWS_MAX_LENGTH}
                        onChange={(e) => setDraft(e.target.value)}
                        className="min-h-[32rem] border-2 border-navy bg-white text-base leading-relaxed text-navy"
                      />
                    )}
                  </Field>
                  <section aria-label="Preview" className="rounded border-2 border-navy p-4">
                    <h2 className="mb-2 text-xs font-bold uppercase tracking-wide">Preview</h2>
                    <Markdown source={draft} idPrefix="preview" />
                  </section>
                  <div className="flex gap-2 xl:col-span-2">
                    <Button onClick={() => void save()} disabled={saving}>
                      {saving ? 'Saving…' : 'Save bylaws'}
                    </Button>
                    <Button variant="secondary" onClick={() => setDraft(null)} disabled={saving}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : text ? (
                <div className="rounded border-2 border-navy p-4">
                  <Markdown source={text} idPrefix="bylaws" />
                </div>
              ) : (
                <Empty>
                  {mayEdit
                    ? 'The council has not entered its bylaws yet. Select Edit bylaws to start from an outline.'
                    : 'The council has not entered its bylaws yet. The Grand Knight or a council Admin can add them.'}
                </Empty>
              )}
            </Panel>
            <EngineFeed council={draft !== null ? { ...row, BylawsMarkdown: draft } : row} />
          </>
        ) : null}
      </div>
    </>
  );
}

export default function BylawsPage() {
  return (
    <RequireArea area="governance/bylaws">
      <BylawsVault />
    </RequireArea>
  );
}

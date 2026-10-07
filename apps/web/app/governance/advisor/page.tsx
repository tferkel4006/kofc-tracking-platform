'use client';
// AI Fraternal & Constitutional Advisor (Sprint 6B, Phase 4): an officer types a parliamentary question and the
// terminal answers from the two-tier engine (adviseQuery, shared advisor.ts). Tier 1 reads the signed-in member's
// council bylaws (Council.BylawsMarkdown through bylawsTokenFeed) and cites the clause id; Tier 2 answers from the
// baseline rules when the vault is empty or no clause matches. Every answer ends with its Source Authority line, and a
// question that asks for a forbidden act shows the PARLIAMENTARY COMPLIANCE WARNING box. The bylaws' audience: every
// signed-in member. Nothing is stored - the conversation lives only in this page.
import { useState } from 'react';
import Link from 'next/link';
import { ADVISOR_QUERY_MAX_LENGTH, adviseQuery, bylawsTokenFeed, councilLabel, type AdvisorAnswer } from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { Button, cx, Notice, PageTitle } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

/** Starter questions shown under the prompt. */
const SUGGESTIONS = ['What is a quorum?', 'How do we take a hand vote?', 'Can we table a motion?', 'How much notice does a motion need?', 'Can a member vote by proxy?'];

interface Exchange {
  id: number;
  question: string;
  reply: AdvisorAnswer;
}

function WarningBox({ text, authority }: { text: string; authority: string }) {
  return (
    <div role="alert" className="rounded border-4 border-hc-gold bg-brand-red p-4 text-white">
      <p className="font-serif text-xl font-bold tracking-wide">⚠ PARLIAMENTARY COMPLIANCE WARNING</p>
      <p className="mt-2 text-lg font-bold">{text}</p>
      <p className="mt-2 text-base">Source Authority: {authority}</p>
    </div>
  );
}

function Reply({ exchange }: { exchange: Exchange }) {
  const { reply } = exchange;
  return (
    <li className="flex flex-col gap-3 border-b-4 border-hc-gold pb-4 last:border-b-0">
      <p className="text-lg">
        <span className="text-hc-gold">Officer ›</span> {exchange.question}
      </p>
      {reply.warnings.map((w) => (
        <WarningBox key={w.text} text={w.text} authority={w.authority} />
      ))}
      <div className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-wide text-hc-gold">
          {reply.tier === 'bylaws'
            ? 'Tier 1 - Council bylaws'
            : reply.fallbackReason === 'no-match'
              ? 'Tier 2 - Baseline rules (no bylaws clause matched)'
              : 'Tier 2 - Baseline rules (the bylaws vault is empty)'}
        </p>
        <p className="whitespace-pre-line text-lg leading-relaxed">{reply.answer}</p>
        <p className="border-l-8 border-hc-gold pl-3 text-base">
          <span className="text-hc-gold">Source Authority:</span> {reply.authority}
        </p>
        {reply.clauseIds.length > 1 ? <p className="text-sm">Also see clauses {reply.clauseIds.slice(1).join(', ')}.</p> : null}
      </div>
    </li>
  );
}

function AdvisorTerminal() {
  const user = useUser();
  const council = useLoad(() => db.councils.get(user.councilId), [user.councilId]);
  const [query, setQuery] = useState('');
  const [log, setLog] = useState<Exchange[]>([]);
  const row = council.data;
  const feed = row ? bylawsTokenFeed(row) : null;

  const ask = (text: string) => {
    const question = text.trim();
    if (!feed || question === '') return;
    setLog((prev) => [{ id: (prev[0]?.id ?? 0) + 1, question, reply: adviseQuery(feed, question) }, ...prev]);
    setQuery('');
  };

  return (
    <>
      <PageTitle>AI Fraternal &amp; Constitutional Advisor</PageTitle>
      <div className="flex flex-col gap-4">
        {council.error ? <Notice tone="error">{council.error}</Notice> : null}
        {row && feed ? (
          <section aria-labelledby="advisor-title" data-surface="black" className="rounded border-4 border-hc-gold bg-black p-4 font-bold text-white sm:p-6">
            <h2 id="advisor-title" className="mb-1 border-b-4 border-hc-gold pb-1 font-serif text-xl">
              Parliamentary terminal - {councilLabel(row)}
            </h2>
            <p className="mb-4 text-base">
              {feed.clauseCount > 0
                ? `Tier 1 active: ${feed.clauseCount} bylaws clauses loaded. Cite a clause by id (for example A2.S1) or ask in plain words.`
                : 'Tier 2 active: the council bylaws vault is empty, so answers come from the baseline parliamentary rules.'}{' '}
              <Link href="/governance/bylaws" className="text-hc-gold underline">
                Open the bylaws
              </Link>
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask(query);
              }}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <label htmlFor="advisor-query" className="sr-only">
                Your question
              </label>
              <input
                id="advisor-query"
                type="text"
                value={query}
                maxLength={ADVISOR_QUERY_MAX_LENGTH}
                autoComplete="off"
                placeholder="Ask a parliamentary question…"
                onChange={(e) => setQuery(e.target.value)}
                className="min-w-0 flex-1 rounded border-4 border-hc-gold bg-black px-3 py-2 text-lg text-white placeholder:text-white/70"
              />
              <Button type="submit" variant="gold" disabled={query.trim() === ''}>
                Ask
              </Button>
            </form>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span>Try:</span>
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border-2 border-hc-gold px-3 py-1 hover:underline">
                  {s}
                </button>
              ))}
            </div>
            <ol aria-live="polite" aria-label="Advisor answers, newest first" className={cx('mt-6 flex flex-col gap-4', log.length === 0 && 'hidden')}>
              {log.map((x) => (
                <Reply key={x.id} exchange={x} />
              ))}
            </ol>
            <p className="mt-6 text-sm">
              The advisor matches your words to the bylaws and the baseline rules; it does not replace the chair, the bylaws or the Charter, Constitution and Laws
              of the Order.
            </p>
          </section>
        ) : null}
      </div>
    </>
  );
}

export default function AdvisorPage() {
  return (
    <RequireArea area="governance/advisor">
      <AdvisorTerminal />
    </RequireArea>
  );
}

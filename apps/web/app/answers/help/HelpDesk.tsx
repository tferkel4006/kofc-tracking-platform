'use client';
// The Interactive Help Desk's search and split pane (Sprint 6A, Phase 4). The member types what they need to do;
// searchGuideTasks ranks the member user guide's task workflows against the keywords. The chosen task shows its five
// parts on the left and, on the right, a read-only CSS mock of the phone screen the task starts on (phoneTarget), or
// the portal start point for a web-only task. The tasks arrive from the server page, parsed from the guide at build.
import { useState, type ReactNode } from 'react';
import { phoneTarget, PHONE_TABS, searchGuideTasks, type GuideTask, type PhoneTarget } from '@kofc/shared';
import { MarkdownInline } from '@/components/Markdown';
import { cx, Empty, Field, Input, PageTitle, Panel } from '@/components/ui';

/** Starter searches shown before the member types, each matching at least one task of the guide. */
const SUGGESTIONS = ['reset password', 'sign up for a shift', 'log hours', 'expense report', 'record a donation', 'meeting agenda', 'large text'];
const MAX_RESULTS = 8;

export function HelpDesk({ tasks }: { tasks: GuideTask[] }) {
  const [query, setQuery] = useState('');
  const [chosenId, setChosenId] = useState('');
  const results = searchGuideTasks(tasks, query).slice(0, MAX_RESULTS);
  const task = results.find((t) => t.id === chosenId) ?? results[0];

  return (
    <>
      <PageTitle>Interactive Help Desk</PageTitle>
      {tasks.length === 0 ? (
        <Empty>The member user guide could not be read. Check that docs/MEMBER_USER_GUIDE.md exists and rebuild the portal.</Empty>
      ) : (
        <div className="flex flex-col gap-4">
          <Panel title="Ask the help desk">
            <div className="flex flex-col gap-3">
              <Field label="What do you need to do?">
                {(id) => (
                  <Input
                    id={id}
                    type="search"
                    value={query}
                    autoComplete="off"
                    placeholder="e.g. file an expense report"
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setChosenId('');
                    }}
                  />
                )}
              </Field>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted">Try:</span>
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => setQuery(s)} className="rounded-full border border-navy px-3 py-1 hover:bg-navy hover:text-white">
                    {s}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted" aria-live="polite">
                {query.trim() === ''
                  ? `${tasks.length} tasks from the Member User Guide.`
                  : `${results.length === 0 ? 'No' : results.length} matching task${results.length === 1 ? '' : 's'}.`}
              </p>
              {results.length > 0 ? (
                <ul className="flex flex-col gap-1" aria-label="Matching tasks">
                  {results.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        aria-current={t.id === task?.id ? 'true' : undefined}
                        onClick={() => setChosenId(t.id)}
                        className={cx(
                          'w-full border-l-8 px-3 py-2 text-left text-sm',
                          t.id === task?.id ? 'border-gold bg-navy font-bold text-white' : 'border-transparent hover:underline',
                        )}
                      >
                        {t.id} {t.title}
                        <span className={cx('ml-2 text-xs font-normal', t.id === task?.id ? 'text-white' : 'text-muted')}>{t.chapter}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : query.trim() !== '' ? (
                <Empty>No task matches “{query}”. Try fewer or different words, or ask in the Online Help Center.</Empty>
              ) : null}
            </div>
          </Panel>
          {task ? <TaskPane task={task} /> : null}
        </div>
      )}
    </>
  );
}

function TaskPane({ task }: { task: GuideTask }) {
  const phone = phoneTarget(task.startPoint);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
      <article aria-labelledby="help-task-title" className="rounded border-2 border-navy bg-white p-5">
        <h2 id="help-task-title" className="font-serif text-xl font-bold">
          {task.id} {task.title}
        </h2>
        <p className="mb-3 text-xs text-muted">Member User Guide · {task.chapter}</p>
        {task.who ? (
          <p className="mb-4 border-l-8 border-gold py-1 pl-3 text-sm">
            <strong>Who can do this:</strong> <MarkdownInline text={task.who} />
          </p>
        ) : null}
        <ol className="flex flex-col gap-4">
          <Part n={1} title="Goal">
            <MarkdownInline text={task.goal} />
          </Part>
          <Part n={2} title="Start point">
            <MarkdownInline text={task.startPoint} />
          </Part>
          <Part n={3} title="Steps">
            <ol className="list-decimal pl-6">
              {task.steps.map((s, i) => (
                <li key={i}>
                  <MarkdownInline text={s} />
                </li>
              ))}
            </ol>
          </Part>
          <Part n={4} title="Expected result">
            <MarkdownInline text={task.expected} />
          </Part>
          <Part n={5} title="Common problems">
            {task.problems.length === 0 ? (
              <p className="text-muted">The guide lists no common problems for this task.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      {['Problem', 'Cause', 'Fix'].map((h) => (
                        <th key={h} scope="col" className="border-2 border-navy bg-navy px-2 py-1 text-left text-white">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {task.problems.map((p, i) => (
                      <tr key={i}>
                        {[p.problem, p.cause, p.fix].map((cell, c) => (
                          <td key={c} className="border border-line px-2 py-1 align-top">
                            <MarkdownInline text={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Part>
        </ol>
      </article>
      <aside aria-label="Where the task starts" className="flex flex-col items-center gap-2">
        {phone ? <PhoneMock target={phone} /> : <PortalStart startPoint={task.startPoint} />}
      </aside>
    </div>
  );
}

function Part({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li>
      <h3 className="mb-1 flex items-center gap-2 font-bold">
        <span aria-hidden="true" className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-navy text-xs text-white">
          {n}
        </span>
        {title}
      </h3>
      <div className="pl-8">{children}</div>
    </li>
  );
}

/** A read-only drawing of the phone app: navy header, the start screen, and the bottom tabs with the gold bar. */
function PhoneMock({ target }: { target: PhoneTarget }) {
  const first = target.trail[0]?.toLowerCase() ?? '';
  const envelope = first.startsWith('envelope');
  const settings = first.startsWith('your name');
  const screen = target.trail[target.trail.length - 1] ?? 'Phone app';
  const label = `Phone app → ${target.trail.join(' → ')}`;
  return (
    <figure className="flex flex-col items-center gap-2">
      <div role="img" aria-label={`Mock phone screen: ${label}`} className="w-64 overflow-hidden rounded-[2.5rem] border-[10px] border-navy bg-navy select-none">
        <div className="flex justify-center bg-navy pb-1">
          <div className="h-2 w-20 rounded-full bg-white/30" />
        </div>
        <div className="flex items-center justify-between bg-navy px-3 py-2 text-sm text-white">
          <span className="font-serif font-bold">KofC Tracker</span>
          <span className="flex items-center gap-2 text-xs">
            <span className={cx('rounded px-1', envelope && 'ring-2 ring-gold')}>✉</span>
            <span className={cx('rounded px-1', settings && 'ring-2 ring-gold')}>Your name</span>
          </span>
        </div>
        <div className="flex h-80 flex-col gap-2 bg-white p-3">
          {target.trail.length > 1 ? <p className="text-[0.65rem] leading-tight text-muted">{target.trail.slice(0, -1).join(' › ')} ›</p> : null}
          <p className="font-serif text-base leading-tight font-bold text-navy">{screen}</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-1 rounded border border-line p-2">
              <div className="h-2 w-3/4 rounded bg-line" />
              <div className="h-2 w-1/2 rounded bg-line/60" />
              {i === 0 ? <div className="mt-1 h-5 w-20 rounded bg-navy" /> : null}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-5 border-t border-line bg-white">
          {PHONE_TABS.map((t) => (
            <span
              key={t}
              className={cx('border-t-4 py-2 text-center text-[0.65rem]', t === target.tab ? 'border-gold font-bold text-navy' : 'border-transparent text-muted')}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="max-w-64 text-center text-xs text-muted">Read-only mock of the phone screen: {label}</figcaption>
    </figure>
  );
}

/** The start point of a task that has no phone screen: it starts in the web portal or outside the app. */
function PortalStart({ startPoint }: { startPoint: string }) {
  return (
    <div className="w-full rounded border-2 border-navy bg-white">
      <div className="flex items-center gap-1 border-b border-line bg-navy px-3 py-2" aria-hidden="true">
        <span className="h-2 w-2 rounded-full bg-white/60" />
        <span className="h-2 w-2 rounded-full bg-white/60" />
        <span className="h-2 w-2 rounded-full bg-white/60" />
      </div>
      <div className="p-4 text-sm">
        <p className="mb-1 font-bold">This task has no phone screen.</p>
        <p>
          Start here: <MarkdownInline text={startPoint} />
        </p>
      </div>
    </div>
  );
}

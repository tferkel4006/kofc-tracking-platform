'use client';
// The SOP Center's reader (Sprint 6Z): a searchable list of the procedures on the left and the chosen one, drawn by
// Markdown, on the right. The documents arrive from the server page, read from docs/sop/.
import { useState } from 'react';
import type { DocFile } from '@kofc/shared';
import { Markdown } from '@/components/Markdown';
import { cx, Empty, Field, Input, PageTitle, Panel } from '@/components/ui';

export function SopCenter({ docs }: { docs: DocFile[] }) {
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState(docs[0]?.slug ?? '');
  const q = query.trim().toLowerCase();
  const shown = q ? docs.filter((d) => d.title.toLowerCase().includes(q) || d.markdown.toLowerCase().includes(q)) : docs;
  const doc = docs.find((d) => d.slug === chosen) ?? shown[0];

  return (
    <>
      <PageTitle>SOP Center</PageTitle>
      {docs.length === 0 ? (
        <Empty>No standard operating procedures are published yet. Add a markdown file to docs/sop/ and rebuild the portal.</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[18rem_1fr]">
          <Panel title="Procedures">
            <div className="flex flex-col gap-3">
              <Field label="Search procedures">
                {(id) => <Input id={id} type="search" value={query} placeholder="e.g. bylaws" onChange={(e) => setQuery(e.target.value)} />}
              </Field>
              {shown.length === 0 ? (
                <Empty>No procedure matches “{query}”.</Empty>
              ) : (
                <ul className="flex flex-col gap-1">
                  {shown.map((d) => (
                    <li key={d.slug}>
                      <button
                        type="button"
                        aria-current={d.slug === doc?.slug ? 'true' : undefined}
                        onClick={() => setChosen(d.slug)}
                        className={cx(
                          'w-full border-l-8 px-3 py-2 text-left text-sm',
                          d.slug === doc?.slug ? 'border-gold bg-navy font-bold text-white' : 'border-transparent hover:underline',
                        )}
                      >
                        {d.title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted">
                {docs.length} procedures · kept as markdown files in docs/sop/
              </p>
            </div>
          </Panel>
          {doc ? (
            <article aria-label={doc.title} className="rounded border-2 border-navy bg-white p-5">
              <Markdown source={doc.markdown} idPrefix={doc.slug} />
            </article>
          ) : null}
        </div>
      )}
    </>
  );
}

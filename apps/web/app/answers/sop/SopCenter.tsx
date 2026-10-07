'use client';
// The SOP Center's reader (Sprint 6Z): a searchable list of the procedures on the left and the chosen one, drawn by
// Markdown, on the right. The documents arrive from the server page, read from docs/sop/.
// Sprint 6A (Phase 4): both panels use the phone's Visually Impaired palette (HIGH_CONTRAST) - pitch-black panels, bold
// white text, thick hc-gold borders - so a procedure reads the same for a member in large text mode on either device.
import { useState } from 'react';
import type { DocFile } from '@kofc/shared';
import { Markdown } from '@/components/Markdown';
import { cx, Empty, PageTitle } from '@/components/ui';

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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr]">
          <section aria-labelledby="sop-list-title" data-surface="black" className="rounded border-4 border-hc-gold bg-black p-4 font-bold text-white">
            <h2 id="sop-list-title" className="mb-3 border-b-4 border-hc-gold pb-1 font-serif text-xl">
              Procedures
            </h2>
            <label htmlFor="sop-search" className="mb-1 block text-base">
              Search procedures
            </label>
            <input
              id="sop-search"
              type="search"
              value={query}
              placeholder="e.g. bylaws"
              onChange={(e) => setQuery(e.target.value)}
              className="mb-3 w-full rounded border-4 border-hc-gold bg-black px-3 py-2 text-lg text-white placeholder:text-white/70"
            />
            {shown.length === 0 ? (
              <p className="text-lg">No procedure matches “{query}”.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {shown.map((d) => (
                  <li key={d.slug}>
                    <button
                      type="button"
                      aria-current={d.slug === doc?.slug ? 'true' : undefined}
                      onClick={() => setChosen(d.slug)}
                      className={cx(
                        'w-full rounded border-4 px-3 py-3 text-left text-lg',
                        d.slug === doc?.slug ? 'border-hc-gold underline' : 'border-transparent hover:border-white',
                      )}
                    >
                      {d.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-base">
              {docs.length} procedures · kept as markdown files in docs/sop/
            </p>
          </section>
          {doc ? (
            <article aria-label={doc.title} data-surface="black" className="rounded border-4 border-hc-gold bg-black p-6">
              <Markdown source={doc.markdown} idPrefix={doc.slug} tone="contrast" />
            </article>
          ) : null}
        </div>
      )}
    </>
  );
}

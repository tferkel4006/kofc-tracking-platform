// SOP Center (Sprint 6Z, docs-as-code): every markdown file in docs/sop/ at the repository root is one standard
// operating procedure. This server component reads the folder when the page is built (and on every request in
// development), so adding, editing or deleting a .md file there is the whole publishing step. The files are written
// to the technical-writer skill's rules (.claude/skills/technical-writer). Open to every signed-in member.
// The page is prerendered, so the folder is read at build time only; turbopackIgnore keeps the build from tracing the
// whole repository into the server bundle.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { docTitle, type DocFile } from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { SopCenter } from './SopCenter';

/** docs/sop/, found from the web app (next build runs in apps/web) or from the repository root. */
async function sopFolder(): Promise<string | null> {
  for (const dir of [path.join(process.cwd(), '..', '..', 'docs', 'sop'), path.join(process.cwd(), 'docs', 'sop')]) {
    try {
      await readdir(/*turbopackIgnore: true*/ dir);
      return dir;
    } catch {
      // try the next location
    }
  }
  return null;
}

async function loadSops(): Promise<DocFile[]> {
  const dir = await sopFolder();
  if (!dir) return [];
  const names = (await readdir(/*turbopackIgnore: true*/ dir)).filter((n) => n.toLowerCase().endsWith('.md') && n.toLowerCase() !== 'readme.md');
  const docs = await Promise.all(
    names.map(async (name) => {
      const markdown = await readFile(/*turbopackIgnore: true*/ `${dir}${path.sep}${name}`, 'utf8');
      const slug = name.replace(/\.md$/i, '');
      return { slug, title: docTitle(slug, markdown), markdown };
    }),
  );
  return docs.sort((a, b) => a.title.localeCompare(b.title));
}

export default async function SopPage() {
  const docs = await loadSops();
  return (
    <RequireArea area="answers/sop">
      <SopCenter docs={docs} />
    </RequireArea>
  );
}

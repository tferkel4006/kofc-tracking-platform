// Docs-as-code files for the Answers pillar's server pages (Sprint 6Z SOP Center, Sprint 6A help desk). The pages are
// prerendered, so these read the repository's docs/ folder at build time only (and on every request in development);
// turbopackIgnore keeps the build from tracing the whole repository into the server bundle.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { docTitle, type DocFile } from '@kofc/shared';

/** The repository's docs/ folder, found from the web app (next build runs in apps/web) or from the repository root. */
async function docsRoot(): Promise<string | null> {
  for (const dir of [path.join(process.cwd(), '..', '..', 'docs'), path.join(process.cwd(), 'docs')]) {
    try {
      await readdir(/*turbopackIgnore: true*/ dir);
      return dir;
    } catch {
      // try the next location
    }
  }
  return null;
}

/** One file under docs/, e.g. 'MEMBER_USER_GUIDE.md', or null when it is missing. */
export async function readDocsFile(name: string): Promise<string | null> {
  const root = await docsRoot();
  if (!root) return null;
  try {
    return await readFile(/*turbopackIgnore: true*/ `${root}${path.sep}${name}`, 'utf8');
  } catch {
    return null;
  }
}

/** Every markdown file of a docs/ subfolder but its README, sorted by title. */
export async function readDocsFolder(folder: string): Promise<DocFile[]> {
  const root = await docsRoot();
  if (!root) return [];
  const dir = `${root}${path.sep}${folder}`;
  let names: string[];
  try {
    names = (await readdir(/*turbopackIgnore: true*/ dir)).filter((n) => n.toLowerCase().endsWith('.md') && n.toLowerCase() !== 'readme.md');
  } catch {
    return [];
  }
  const docs = await Promise.all(
    names.map(async (name) => {
      const markdown = await readFile(/*turbopackIgnore: true*/ `${dir}${path.sep}${name}`, 'utf8');
      const slug = name.replace(/\.md$/i, '');
      return { slug, title: docTitle(slug, markdown), markdown };
    }),
  );
  return docs.sort((a, b) => a.title.localeCompare(b.title));
}

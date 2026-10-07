// SOP Center (Sprint 6Z, docs-as-code): every markdown file in docs/sop/ at the repository root is one standard
// operating procedure. This server component reads the folder when the page is built (and on every request in
// development), so adding, editing or deleting a .md file there and rebuilding is the whole publishing step. The files
// are written to the technical-writer skill's rules (.claude/skills/technical-writer). Open to every signed-in member.
// Sprint 6A (Phase 4): the reader draws in the high-contrast Visually Impaired palette.
import { readDocsFolder } from '@/lib/docs-files';
import { RequireArea } from '@/components/CouncilScope';
import { SopCenter } from './SopCenter';

export default async function SopPage() {
  const docs = await readDocsFolder('sop');
  return (
    <RequireArea area="answers/sop">
      <SopCenter docs={docs} />
    </RequireArea>
  );
}

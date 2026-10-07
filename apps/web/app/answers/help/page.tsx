// Interactive Help Desk (Sprint 6A, Phase 4): a member types what they need to do and the desk shows the matching task
// workflow of docs/MEMBER_USER_GUIDE.md - its five parts, Goal to Common problems - beside a read-only mock of the phone
// screen the task starts on. The guide is read and split into tasks (parseGuideTasks) when the page is built, so an
// edit to the guide reaches the desk on the next build. Open to every signed-in member.
import { parseGuideTasks } from '@kofc/shared';
import { readDocsFile } from '@/lib/docs-files';
import { RequireArea } from '@/components/CouncilScope';
import { HelpDesk } from './HelpDesk';

export default async function HelpDeskPage() {
  const guide = await readDocsFile('MEMBER_USER_GUIDE.md');
  return (
    <RequireArea area="answers/help">
      <HelpDesk tasks={guide ? parseGuideTasks(guide) : []} />
    </RequireArea>
  );
}

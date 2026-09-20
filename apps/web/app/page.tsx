import { redirect } from 'next/navigation';

// The planner is the working home for admins; other roles are steered by the navigation.
export default function Home() {
  redirect('/events');
}

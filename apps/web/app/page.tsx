import { redirect } from 'next/navigation';

// Every Knight, Admins included, starts at the member hub: their shifts, open sign-ups and hours.
export default function Home() {
  redirect('/member-actions');
}

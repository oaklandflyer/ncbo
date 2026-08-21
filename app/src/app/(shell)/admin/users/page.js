import { redirect } from 'next/navigation';

/* The member admin screen already exists and is the one admins use. Pointing
   at it rather than growing a second copy: two screens that manage accounts is
   how one of them stops being maintained. */
export default function AdminUsers() {
  redirect('/hub/admin/users');
}

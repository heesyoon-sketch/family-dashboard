import { redirect } from 'next/navigation';

// Shields and Family Growth are one page now; old links land on the Shield Wall.
export default function ShieldsPage() {
  redirect('/stats#shield-wall');
}

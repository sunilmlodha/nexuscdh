import { redirect } from 'next/navigation';

// The Customer Attribute Repository (CAR) has been merged into the unified
// Customer Profiles feature at /profiles (Ingest + Schema tabs). This route
// is kept as a permanent redirect so existing links/bookmarks continue to work.
export default function CARRedirect() {
  redirect('/profiles');
}

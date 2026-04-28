import { LandingDashboard } from '@/components/LandingDashboard';

// Root path renders the dashboard view. /dashboard is a separate route
// for explicit-link cases (sharing, bookmarks); content is the same.
export default function Home() {
  return <LandingDashboard />;
}

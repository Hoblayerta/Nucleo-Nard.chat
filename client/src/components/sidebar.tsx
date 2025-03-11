import { Link, useLocation } from "wouter";
import { 
  Home,
  TrendingUp,
  Trophy,
  Users,
  Bookmark
} from "lucide-react";
import LeaderboardWidget from "./leaderboard-widget";
import { cn } from "@/lib/utils";

export default function Sidebar() {
  const [location] = useLocation();

  const navigation = [
    { name: "Home", icon: Home, href: "/" },
    { name: "Popular", icon: TrendingUp, href: "/popular" },
    { name: "Leaderboard", icon: Trophy, href: "/leaderboard" },
    { name: "Communities", icon: Users, href: "/communities" },
    { name: "Saved", icon: Bookmark, href: "/saved" },
  ];

  return (
    <aside className="w-full md:w-64 space-y-6">
      <div className="bg-card p-4 rounded-md shadow">
        <h3 className="font-medium text-lg mb-3 border-b border-border pb-2">Navigation</h3>
        <ul className="space-y-2">
          {navigation.map((item) => {
            const isActive = location === item.href;
            
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center hover:text-primary",
                    isActive ? "text-primary" : "text-foreground"
                  )}
                >
                  <item.icon className={cn(
                    "w-5 h-5 mr-2",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span>{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      
      <LeaderboardWidget />
    </aside>
  );
}

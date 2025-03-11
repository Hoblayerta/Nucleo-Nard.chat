import { Link, useLocation } from "wouter";
import { 
  Home,
  Trophy,
  Users,
  Bookmark,
  AlertCircle
} from "lucide-react";
import LeaderboardWidget from "./leaderboard-widget";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default function Sidebar() {
  const [location] = useLocation();

  const navigation = [
    { name: "Home", icon: Home, href: "/" },
    { name: "Leaderboard", icon: Trophy, href: "/leaderboard" },
    { 
      name: "Communities", 
      icon: Users, 
      href: "/communities", 
      badge: "Soon",
      comingSoon: true
    },
    { 
      name: "Saved", 
      icon: Bookmark, 
      href: "/saved", 
      badge: "Soon",
      comingSoon: true
    },
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
                  href={item.comingSoon ? "#" : item.href}
                  className={cn(
                    "flex items-center justify-between hover:text-primary",
                    isActive ? "text-primary" : "text-foreground"
                  )}
                  title={item.comingSoon ? "Coming soon!" : ""}
                >
                  <div className="flex items-center">
                    <item.icon className={cn(
                      "w-5 h-5 mr-2",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <Badge variant="outline" className="text-xs bg-primary/10 text-primary">
                      {item.badge}
                    </Badge>
                  )}
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

import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { 
  Home,
  Trophy,
  Users,
  Bookmark,
  Menu,
  X,
  ChevronRight
} from "lucide-react";
import LeaderboardWidget from "./leaderboard-widget";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

// Hook para detectar si estamos en móvil
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Verificar al inicio
    checkIsMobile();
    
    // Agregar un listener para cambios de tamaño
    window.addEventListener('resize', checkIsMobile);
    
    // Limpiar el listener
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);
  
  return isMobile;
}

export default function Sidebar() {
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);

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

  const NavigationLinks = () => (
    <ul className="space-y-2">
      {navigation.map((item) => {
        const isActive = location === item.href;
        
        return (
          <li key={item.name}>
            <Link
              href={item.comingSoon ? "#" : item.href}
              className={cn(
                "flex items-center justify-between hover:text-primary p-2 rounded-md transition-colors",
                isActive ? "text-primary bg-primary/10" : "text-foreground"
              )}
              title={item.comingSoon ? "Coming soon!" : ""}
              onClick={() => isMobile && setIsOpen(false)}
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
              {item.comingSoon && (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  // Para móvil, usamos el componente Sheet
  if (isMobile) {
    return (
      <>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="fixed bottom-4 right-4 z-50 rounded-full shadow-md">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-lg">Navigation</h3>
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            <div className="p-4">
              <NavigationLinks />
            </div>
            <div className="p-4 border-t">
              <LeaderboardWidget />
            </div>
          </SheetContent>
        </Sheet>
        
        {/* Contenedor que ocupa espacio mínimo en móvil */}
        <aside className="hidden">
          {/* No mostramos nada en móvil */}
        </aside>
      </>
    );
  }

  // Para desktop, mostramos la barra lateral normal
  return (
    <aside className="hidden md:block w-64 space-y-6 flex-shrink-0">
      <div className="bg-card p-4 rounded-md shadow">
        <h3 className="font-medium text-lg mb-3 border-b border-border pb-2">Navigation</h3>
        <NavigationLinks />
      </div>
      
      <LeaderboardWidget />
    </aside>
  );
}

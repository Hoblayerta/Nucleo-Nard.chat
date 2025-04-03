import { Link, useLocation } from "wouter";
import { 
  Home,
  Trophy,
  Users,
  Bookmark,
  AlertCircle,
  GitBranchPlus,
  Network
} from "lucide-react";
import LeaderboardWidget from "./leaderboard-widget";
import CommentTreeView from "./comment-tree-view";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import React, { useState, useEffect } from "react";

// Componente Layout para el visualizador de comentarios
interface CommentTreeViewLayoutProps {
  postId: number;
  onClose: () => void;
}

function CommentTreeViewLayout({ postId, onClose }: CommentTreeViewLayoutProps) {
  // Esta función se llamará cuando el usuario seleccione un comentario específico
  const handleCommentSelect = (commentId: number) => {
    // Cerrar el visualizador
    onClose();
    
    // Desplazarse al comentario seleccionado
    setTimeout(() => {
      const commentElement = document.getElementById(`comment-${commentId}`);
      if (commentElement) {
        commentElement.scrollIntoView({ behavior: 'smooth' });
        // Resaltar brevemente el comentario
        commentElement.classList.add('bg-primary/10');
        setTimeout(() => {
          commentElement.classList.remove('bg-primary/10');
        }, 2000);
      }
    }, 100);
  };
  
  return (
    <CommentTreeView 
      postId={postId} 
      onClose={onClose} 
      onCommentSelect={handleCommentSelect}
    />
  );
}

export default function Sidebar() {
  const [location] = useLocation();
  const [showCommentTree, setShowCommentTree] = useState(false);
  const [currentPostId, setCurrentPostId] = useState<number | null>(null);

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

  // Check if the current path is a post page
  useEffect(() => {
    const match = location.match(/\/post\/(\d+)/);
    if (match && match[1]) {
      setCurrentPostId(parseInt(match[1], 10));
    } else {
      setCurrentPostId(null);
    }
  }, [location]);

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
      
      {/* Visualizador de Comentarios se muestra solo en páginas de post */}
      {currentPostId ? (
        <div className="bg-card p-4 rounded-md shadow">
          <h3 className="font-medium text-lg mb-3 border-b border-border pb-2">
            Visualización de Comentarios
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Visualiza los comentarios del post en un formato gráfico tipo árbol.
          </p>
          <Button 
            variant="outline" 
            className="w-full flex items-center justify-center"
            onClick={() => setShowCommentTree(true)}
          >
            <Network className="w-4 h-4 mr-2" />
            Ver Árbol de Comentarios
          </Button>
          
          {showCommentTree && currentPostId && (
            <CommentTreeViewLayout 
              postId={currentPostId} 
              onClose={() => setShowCommentTree(false)} 
            />
          )}
        </div>
      ) : (
        <LeaderboardWidget />
      )}
    </aside>
  );
}

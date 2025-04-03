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
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CommentWithUser } from "@shared/schema";

// Componente que muestra el árbol de comentarios directamente en el sidebar
interface SidebarCommentTreeProps {
  postId: number;
}

function SidebarCommentTree({ postId }: SidebarCommentTreeProps) {
  const [selectedCommentId, setSelectedCommentId] = useState<number | null>(null);
  
  // Función que se llama cuando se selecciona un comentario
  const handleCommentSelect = (commentId: number) => {
    setSelectedCommentId(commentId);
    
    // Desplazarse al comentario seleccionado
    setTimeout(() => {
      const commentElement = document.getElementById(`comment-${commentId}`);
      if (commentElement) {
        // Para dispositivos móviles, es importante asegurarse de que el usuario vea el comentario
        // scrollIntoView puede funcionar de manera diferente dependiendo del navegador
        commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Resaltar brevemente el comentario
        commentElement.classList.add('bg-primary/20');
        setTimeout(() => {
          commentElement.classList.remove('bg-primary/20');
        }, 2000);
      }
    }, 100);
  };
  
  return (
    <div className="h-[400px] relative overflow-hidden rounded-md border border-muted">
      <CommentTreeView 
        postId={postId} 
        onClose={() => {}} // No hay nada que cerrar aquí ya que está integrado en el sidebar
        onCommentSelect={handleCommentSelect}
      />
    </div>
  );
}

export default function Sidebar() {
  const [location] = useLocation();
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

  // Verificar si estamos en una página de post
  useEffect(() => {
    const match = location.match(/\/post\/(\d+)/);
    if (match && match[1]) {
      setCurrentPostId(parseInt(match[1], 10));
    } else {
      setCurrentPostId(null);
    }
  }, [location]);

  // Consultar la información de comentarios para el post actual
  const { data: comments = [], isLoading } = useQuery<CommentWithUser[]>({
    queryKey: [`/api/posts/${currentPostId}/comments`],
    queryFn: async () => {
      if (!currentPostId) return [];
      const res = await apiRequest("GET", `/api/posts/${currentPostId}/comments`);
      return res.json();
    },
    enabled: !!currentPostId, // Solo consultar cuando hay un ID de post
  });

  return (
    <aside className="w-full md:w-64 space-y-6">
      <div className="bg-card p-4 rounded-md shadow">
        <h3 className="font-medium text-lg mb-3 border-b border-border pb-2">Navegación</h3>
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
      
      {/* Visualizador de árbol de comentarios en lugar de Top Comments cuando estamos en una página de post */}
      {currentPostId ? (
        <div className="bg-card p-4 rounded-md shadow border-2 border-primary/20">
          <h3 className="font-medium text-lg mb-3 border-b border-border pb-2">
            Árbol de Comentarios
          </h3>
          {comments.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                Visualización jerárquica de los comentarios. Haz clic en un nodo para ver ese comentario.
              </p>
              {isLoading ? (
                <div className="flex items-center justify-center h-[200px]">
                  <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full"></div>
                  <span className="ml-2">Cargando...</span>
                </div>
              ) : (
                <SidebarCommentTree postId={currentPostId} />
              )}
            </>
          ) : (
            <div className="text-center py-6 px-4">
              <div className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 2h6"></path><path d="M5 7v12a3 3 0 0 0 3 3v0"></path><path d="M19 7v12a3 3 0 0 1-3 3v0"></path><path d="M12 22v-5"></path><path d="M5 7H2a10 10 0 0 0 10 10"></path><path d="M19 7h3a10 10 0 0 1-10 10"></path>
                </svg>
              </div>
              <h4 className="font-medium mb-2">No hay comentarios aún</h4>
              <p className="text-sm text-muted-foreground mb-3">
                El árbol de comentarios aparecerá una vez que se agreguen comentarios al post.
              </p>
            </div>
          )}
        </div>
      ) : (
        <LeaderboardWidget />
      )}
    </aside>
  );
}

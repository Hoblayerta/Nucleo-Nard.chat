import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSlowMode } from "@/hooks/use-slow-mode";
import { useAuth } from "@/lib/auth";
import CommentThread from "@/components/comment-thread";
import CommentForm from "@/components/comment-form";
import { Progress } from "@/components/ui/progress";
import { Clock } from "lucide-react";
import type { PostWithDetails } from "@shared/schema";

export default function Post() {
  const params = useParams();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { user, isAdmin, isModerator } = useAuth();
  
  // Analizamos los parámetros de consulta para obtener el ID del comentario
  const searchParams = new URLSearchParams(window.location.search);
  const commentIdFromURL = searchParams.get('comment');
  const [commentId, setCommentId] = useState<string | null>(commentIdFromURL);
  
  // Efecto para mostrar un toast cuando hay un comentario en la URL
  useEffect(() => {
    if (commentIdFromURL) {
      toast({
        title: "Navegando al comentario",
        description: "Te estamos llevando al comentario compartido...",
        duration: 3000,
      });
      
      // Hacer que el resaltado se quite después de un tiempo
      const timer = setTimeout(() => {
        setCommentId(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [commentIdFromURL, toast]);
  
  const postId = parseInt(params.id || "0", 10);
  
  const { data: post, isLoading, isError } = useQuery<PostWithDetails>({
    queryKey: [`/api/posts/${postId}`],
    enabled: postId > 0,
  });
  
  useEffect(() => {
    if (isError) {
      toast({
        title: "Error",
        description: "No se pudo cargar el post solicitado.",
        variant: "destructive",
      });
      
      // Redirigir a home si hay error
      setLocation("/");
    }
  }, [isError, setLocation, toast]);
  
  if (isLoading || !post) {
    return (
      <div className="container max-w-4xl mx-auto p-4 mt-8">
        <div className="text-center py-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-2 text-muted-foreground">Cargando post...</p>
        </div>
      </div>
    );
  }

  // Actualizar el contexto de SlowMode cuando cambie el intervalo
  const { updateSlowModeInterval } = useSlowMode();
  
  useEffect(() => {
    if (post?.slowModeInterval >= 0) {
      updateSlowModeInterval(post.slowModeInterval);
    }
  }, [post?.slowModeInterval, updateSlowModeInterval]);

  return (
    <div className="container max-w-4xl mx-auto p-4 my-8">
      <article className="bg-card rounded-lg shadow-sm p-6 mb-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold mb-2">{post.title}</h1>
          
          <div className="flex items-center mb-4">
            <div>
              <span className="font-medium text-primary">
                {post.user.username}
              </span>
              <span className="text-xs text-muted-foreground ml-2">
                {new Date(post.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          
          <div className="prose max-w-none">
            <div dangerouslySetInnerHTML={{ __html: post.content }} />
          </div>
        </div>
        
        <div className="flex items-center justify-between text-sm text-muted-foreground mt-6 pt-4 border-t">
          <div className="flex">
            <div className="mr-4 flex items-center">
              <span className="font-medium text-foreground">{post.voteScore || 0}</span>
              <span className="ml-1">votos</span>
            </div>
            
            <div className="flex items-center">
              <span className="font-medium text-foreground">{post.comments}</span>
              <span className="ml-1">comentarios</span>
            </div>
            
            {post.slowModeInterval > 0 && (
              <div className="ml-4 flex items-center text-yellow-600">
                <Clock className="h-4 w-4 mr-1" />
                <span className="font-medium">Modo lento: {post.slowModeInterval}s</span>
              </div>
            )}
          </div>
          
          <button 
            className="flex items-center text-primary hover:text-primary/80 transition"
            onClick={() => {
              const url = window.location.href;
              navigator.clipboard.writeText(url).then(() => {
                toast({
                  title: "Link copiado!",
                  description: "El enlace del post ha sido copiado al portapapeles.",
                  duration: 3000,
                });
              });
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            <span>Compartir</span>
          </button>
        </div>
      </article>
      
      {/* Mostrar un aviso si el post está congelado */}
      {post.frozen && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6 rounded-md" role="alert">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            <p className="font-medium">Este post ha sido bloqueado por un administrador.</p>
          </div>
          <p className="text-sm mt-1">No se pueden añadir nuevos comentarios ni votar en este post.</p>
        </div>
      )}
      
      {/* Barra de estado para el modo lento global si está activo */}
      {post.slowModeInterval > 0 && (
        <div className="mt-4 mb-6 p-3 bg-yellow-50/30 border border-yellow-200/50 rounded-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm flex items-center">
              <Clock className="h-4 w-4 mr-2 text-yellow-600" />
              <span>Modo lento: intervalo de {post.slowModeInterval} segundos entre comentarios</span>
            </span>
          </div>
        </div>
      )}
      
      {/* Sección de formulario de comentario principal - solo si no está congelado */}
      {!post.frozen && (
        <section className="bg-card rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-lg font-bold mb-3">
            Deja un comentario
          </h3>
          <CommentForm 
            postId={post.id} 
          />
        </section>
      )}
      
      {/* Ya se añadieron los botones de exportación en el componente PostCard */}
      
      {/* Sección de comentarios existentes */}
      <section className="bg-card rounded-lg shadow-sm p-6">
        <CommentThread 
          postId={post.id} 
          highlightedCommentId={commentId} 
          isFrozen={post.frozen}
          slowModeInterval={post.slowModeInterval}
        />
      </section>
    </div>
  );
}
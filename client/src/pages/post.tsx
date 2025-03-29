import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import CommentThread from "@/components/comment-thread";
import CommentForm from "@/components/comment-form";
import { Button } from "@/components/ui/button";
import { LockIcon, UnlockIcon } from "lucide-react";
import type { PostWithDetails } from "@shared/schema";

export default function Post() {
  const params = useParams();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  
  // Obtener el ID del comentario de los parámetros de consulta si existe
  const [commentId, setCommentId] = useState<string | null>(null);
  
  // Analizamos los parámetros de consulta
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const comment = searchParams.get('comment');
    if (comment) {
      setCommentId(comment);
      
      // Mostrar un toast para indicar que se está navegando a un comentario específico
      toast({
        title: "Navegando al comentario",
        description: "Te estamos llevando al comentario compartido...",
        duration: 3000,
      });
    }
  }, [toast]);
  
  const postId = parseInt(params.id || "0", 10);
  
  const { data: post, isLoading, isError } = useQuery<PostWithDetails>({
    queryKey: [`/api/posts/${postId}`],
    enabled: postId > 0,
  });
  
  // Mutation para alternar el estado de bloqueo del post
  const toggleLockMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/posts/${postId}/lock`, {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.isLocked ? "Post bloqueado" : "Post desbloqueado",
        description: data.message,
        duration: 3000,
      });
      
      // Invalidar caché para refrescar los datos
      queryClient.invalidateQueries({ queryKey: [`/api/posts/${postId}`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo cambiar el estado de bloqueo del post.",
        variant: "destructive",
      });
    }
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

  return (
    <div className="container max-w-4xl mx-auto p-4 my-8">
      <article className="bg-card rounded-lg shadow-sm p-6 mb-6">
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-2xl font-bold">{post.title}</h1>
            
            {isAdmin && (
              <Button
                variant={post.isLocked ? "outline" : "destructive"} 
                size="sm"
                onClick={() => toggleLockMutation.mutate()}
                disabled={toggleLockMutation.isPending}
              >
                {toggleLockMutation.isPending ? (
                  <span className="animate-pulse">Actualizando...</span>
                ) : post.isLocked ? (
                  <>
                    <UnlockIcon className="h-4 w-4 mr-1" />
                    <span>Desbloquear</span>
                  </>
                ) : (
                  <>
                    <LockIcon className="h-4 w-4 mr-1" />
                    <span>Bloquear</span>
                  </>
                )}
              </Button>
            )}
          </div>
          
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
          
          {post.isLocked && (
            <div className="bg-amber-100 dark:bg-amber-950 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 p-3 rounded-md mb-4 flex items-center">
              <LockIcon className="h-5 w-5 mr-2 flex-shrink-0" />
              <p className="text-sm">
                Este post ha sido bloqueado por un administrador. No se permiten nuevos comentarios ni valoraciones.
              </p>
            </div>
          )}
          
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
      
      {/* Sección de formulario de comentario principal - solo si el post no está bloqueado */}
      {!post.isLocked && (
        <section className="bg-card rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-lg font-bold mb-3">Deja un comentario</h3>
          <CommentForm postId={post.id} />
        </section>
      )}
      
      {/* Sección de comentarios existentes */}
      <section className="bg-card rounded-lg shadow-sm p-6">
        {post.isLocked && (
          <div className="border-l-4 border-amber-400 pl-3 py-2 mb-4 bg-amber-50 dark:bg-amber-950/30">
            <p className="text-amber-800 dark:text-amber-300 text-sm">
              Este post está bloqueado. La discusión ha sido cerrada.
            </p>
          </div>
        )}
        <CommentThread postId={post.id} highlightedCommentId={commentId} />
      </section>
    </div>
  );
}
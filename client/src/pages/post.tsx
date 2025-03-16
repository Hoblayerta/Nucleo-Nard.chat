import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import CommentThread from "@/components/comment-thread";
import CommentForm from "@/components/comment-form";
import type { PostWithDetails } from "@shared/schema";

export default function Post() {
  const params = useParams();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
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
        
        <div className="flex items-center text-sm text-muted-foreground mt-6 pt-4 border-t">
          <div className="mr-4 flex items-center">
            <span className="font-medium text-foreground">{post.likes}</span>
            <span className="ml-1">likes</span>
          </div>
          
          <div className="flex items-center">
            <span className="font-medium text-foreground">{post.comments}</span>
            <span className="ml-1">comentarios</span>
          </div>
        </div>
      </article>
      
      <section className="bg-card rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Añadir comentario</h2>
        <CommentForm postId={post.id} />
      </section>
      
      <section className="bg-card rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-4">Comentarios ({post.comments})</h2>
        <CommentThread postId={post.id} highlightedCommentId={commentId} />
      </section>
    </div>
  );
}
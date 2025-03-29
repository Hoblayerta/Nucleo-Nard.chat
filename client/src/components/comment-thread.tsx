import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowUp, ArrowDown, MessageSquare, Share2, Shield, Flame, CornerDownRight, ChevronRight, MinusSquare, PlusSquare, Link } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import CommentForm from "./comment-form";
import type { CommentWithUser } from "@shared/schema";
import "./comment-thread.css"; // Importar los estilos CSS específicos

interface CommentThreadProps {
  postId: number;
  highlightedCommentId?: string | null;
}

interface CommentItemProps {
  comment: CommentWithUser;
  postId: number;
  level?: number;
  index?: string; // Índice para la enumeración del hilo, ej: "1", "1.2", "1.2.3"
  highlightedCommentId?: string | null;
}

function CommentItem({ comment, postId, level = 0, index = "", highlightedCommentId }: CommentItemProps) {
  // Añadir una clase para identificar nivel de anidación
  const nestingClass = `nesting-level-${level}`;
  const commentRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [replyOpen, setReplyOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const isMobile = useIsMobile();
  
  // Determina si este comentario debería estar resaltado
  const shouldHighlight = 
    highlightedCommentId === comment.id.toString() || 
    (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('comment') === comment.id.toString());
    
  // Determina si el usuario ha votado en este comentario
  const userVoteStatus = comment.userVote || null;
  
  // Efecto para hacer scroll al comentario si es el solicitado en la URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const commentId = params.get('comment');
    
    if ((commentId === comment.id.toString() || highlightedCommentId === comment.id.toString()) && commentRef.current) {
      // Si el comentario está en respuestas colapsadas, expandirlas
      if ('parentId' in comment && comment.parentId && !expanded) {
        setExpanded(true);
      }
      
      // Añadir un pequeño delay para asegurar que el DOM está listo
      setTimeout(() => {
        commentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Añadir una clase para destacar brevemente el comentario
        commentRef.current?.classList.add('highlight-comment');
        setTimeout(() => {
          commentRef.current?.classList.remove('highlight-comment');
        }, 2000);
      }, 500);
    }
  }, [comment.id, expanded, highlightedCommentId]);
  
  const voteMutation = useMutation({
    mutationFn: async ({ isUpvote }: { isUpvote: boolean }) => {
      const res = await apiRequest("POST", "/api/votes", {
        commentId: comment.id,
        isUpvote
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/posts/${postId}/comments`] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to vote on comment. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleVote = (isUpvote: boolean) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to vote on comments",
        variant: "destructive",
      });
      return;
    }
    
    voteMutation.mutate({ isUpvote });
  };

  const timeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return `${diffInSeconds} seconds ago`;
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) {
      return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
    }
    
    return format(date, "MMM d, yyyy");
  };
    
  return (
    <div ref={commentRef} className={`relative ${nestingClass} comment-item ${shouldHighlight ? 'highlight-comment' : ''}`}>
      {isMobile && level > 0 && (
        <div className="flex items-center text-xs text-muted-foreground mb-1 ml-1">
          <CornerDownRight className="h-3 w-3 mr-1" />
          <span>Nivel {level}{index ? ` - #${index}` : ''}</span>
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-1 mb-0">
          {/* Panel de votos a la altura del nombre */}
          <div className="flex items-center mr-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className={`px-1 py-0 h-5 ${userVoteStatus === 'upvote' ? 'text-success hover:text-success/80' : 'hover:text-success'}`}
              onClick={() => handleVote(true)}
              disabled={voteMutation.isPending}
            >
              <ArrowUp className="h-3 w-3" />
            </Button>
            <span className="text-xs mx-px">{comment.voteScore || 0}</span>
            <Button 
              variant="ghost" 
              size="sm" 
              className={`px-1 py-0 h-5 ${userVoteStatus === 'downvote' ? 'text-destructive hover:text-destructive/80' : 'hover:text-destructive'}`}
              onClick={() => handleVote(false)}
              disabled={voteMutation.isPending}
            >
              <ArrowDown className="h-3 w-3" />
            </Button>
          </div>
          
          {index && (
            <Badge variant="outline" className="mr-1 text-xs bg-muted/30 h-5 px-1">
              #{index}
            </Badge>
          )}
          
          <a href={`/profile/${comment.user.id}`} className="font-medium text-primary hover:underline text-sm">
            {comment.user.username}
          </a>
          
          {comment.user.role === "admin" && (
            <Badge variant="outline" className="bg-success/20 text-success border-success/30 h-5 text-xs">
              <Shield className="h-2.5 w-2.5 mr-0.5" /> Admin
            </Badge>
          )}
          
          {comment.user.role === "moderator" && (
            <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 h-5 text-xs">
              <Shield className="h-2.5 w-2.5 mr-0.5" /> Mod
            </Badge>
          )}
          
          <span className="text-xs text-success flex items-center h-5">
            <Flame className="h-2.5 w-2.5 mr-0.5" />
            x{comment.user.likeMultiplier}
          </span>
          
          <span className="text-xs text-muted-foreground">•</span>
          
          <span className="text-xs text-muted-foreground">
            {timeAgo(new Date(comment.createdAt))}
          </span>
        </div>
        
        <p className="text-sm mb-1 mt-1">{comment.content}</p>
        
        <div className="flex items-center text-xs text-muted-foreground">
          <Button 
            variant="ghost" 
            size="sm" 
            className="px-1 py-0 h-5 hover:text-primary mr-2"
            onClick={() => setReplyOpen(!replyOpen)}
          >
            <MessageSquare className="h-3 w-3 mr-1" />
            Reply
          </Button>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="px-1 py-0 h-5 hover:text-primary"
                  onClick={() => {
                    const commentUrl = `${window.location.origin}/posts/${postId}?comment=${comment.id}`;
                    navigator.clipboard.writeText(commentUrl)
                      .then(() => {
                        toast({
                          title: "¡Enlace copiado!",
                          description: `Puedes compartir este comentario ${index ? `(#${index})` : ""} con otros.`,
                        });
                      })
                      .catch(() => {
                        toast({
                          title: "Error",
                          description: "No se pudo copiar el enlace. Intenta de nuevo.",
                          variant: "destructive",
                        });
                      });
                  }}
                >
                  <Share2 className="h-3 w-3 mr-1" />
                  Compartir
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Copiar enlace al comentario {index ? `#${index}` : ""}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        {replyOpen && (
          <div className="mt-2">
            <CommentForm 
              postId={postId} 
              parentId={comment.id} 
              onSuccess={() => setReplyOpen(false)}
            />
          </div>
        )}
        
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2 relative comment-replies-container">
            {isMobile && (
              <div className="mb-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs flex items-center text-muted-foreground hover:text-primary w-full justify-start h-6 px-1"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? (
                    <>
                      <MinusSquare className="h-3 w-3 mr-1" />
                      Ocultar {comment.replies.length} {comment.replies.length === 1 ? 'respuesta' : 'respuestas'}
                    </>
                  ) : (
                    <>
                      <PlusSquare className="h-3 w-3 mr-1" />
                      Mostrar {comment.replies.length} {comment.replies.length === 1 ? 'respuesta' : 'respuestas'}
                    </>
                  )}
                </Button>
              </div>
            )}
            
            {(!isMobile || expanded) && (
              <div 
                className={`space-y-2 nested-comment ${isMobile ? 'mobile-nested-comment' : ''}`}
                style={{ 
                  marginLeft: '0.125rem',
                  minWidth: 'calc(100% - 0.25rem)',
                  position: 'relative',
                  paddingLeft: '8px' // Reducido el espacio para la línea vertical
                }}
              >
                {/* Línea vertical de color según el nivel de anidación */}
                <div 
                  className="lemmy-vertical-line" 
                  style={{ 
                    backgroundColor: [
                      '#3b82f6', // Azul
                      '#06b6d4', // Turquesa
                      '#10b981', // Verde
                      '#84cc16', // Verde limón
                      '#eab308', // Amarillo
                      '#f59e0b', // Amarillo naranja
                      '#f97316', // Naranja
                      '#ef4444', // Rojo
                      '#ec4899', // Magenta
                      '#d946ef', // Violeta
                      '#8b5cf6', // Morado
                      '#0ea5e9', // Azul cyan
                      '#3b82f6'  // Azul (repetido)
                    ][level % 13]
                  }}
                />
                
                {comment.replies.map((reply, replyIndex) => (
                  <CommentItem 
                    key={reply.id} 
                    comment={reply} 
                    postId={postId}
                    level={(level + 1) % 13} // Usar módulo 13 para ciclar entre los 13 colores
                    index={index ? `${index}.${replyIndex + 1}` : `${replyIndex + 1}`}
                    highlightedCommentId={highlightedCommentId}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CommentThread({ postId, highlightedCommentId }: CommentThreadProps) {
  const { data: comments = [], isLoading } = useQuery<CommentWithUser[]>({
    queryKey: [`/api/posts/${postId}/comments`],
  });
  
  // Importante: declarar los hooks ANTES de cualquier condicional
  // para evitar errores con las reglas de hooks
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="text-center py-4">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
        <p className="mt-2 text-sm text-muted-foreground">Loading comments...</p>
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-muted-foreground">No comments yet. Be the first to comment!</p>
      </div>
    );
  }
  
  return (
    <div className="relative">
      {/* Información de navegación para móviles */}
      {isMobile && (
        <div className="mb-3 p-2 bg-muted/20 rounded-md">
          <p className="text-xs text-muted-foreground mb-1">
            <ChevronRight className="h-3 w-3 inline mr-1" />
            Para comentarios anidados, usa el botón de mostrar/ocultar respuestas
          </p>
          <p className="text-xs text-muted-foreground">
            <Link className="h-3 w-3 inline mr-1" />
            Los comentarios están enumerados (#1, #1.2, #2.1, etc.) para facilitar referencias
          </p>
        </div>
      )}
      
      {/* Agregar formulario de comentario al inicio, como en Lemmy */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-3">Escribe un comentario</h3>
        <CommentForm postId={postId} />
      </div>
      
      {/* Separador entre formulario y comentarios */}
      <Separator className="my-6" />
      
      {/* Título de la sección de comentarios */}
      <h3 className="text-lg font-medium mb-4">
        {comments.length} {comments.length === 1 ? 'Comentario' : 'Comentarios'}
      </h3>
      
      {/* Contenedor exterior que establece los límites */}
      <div className="space-y-6 comment-thread-container">
        {/* Contenedor interior que puede desbordarse horizontalmente */}
        <div className="comment-thread-main">
          {comments.map((comment, index) => (
            <CommentItem 
              key={comment.id} 
              comment={comment} 
              postId={postId} 
              index={`${index + 1}`}
              highlightedCommentId={highlightedCommentId}
            />
          ))}
          
          {comments.length > 5 && (
            <Button 
              variant="outline" 
              className="w-full mt-4"
            >
              Mostrar más comentarios
            </Button>
          )}
        </div>
      </div>
      
      {/* Indicador de desplazamiento horizontal */}
      {!isMobile && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-50 pointer-events-none"></div>
      )}
    </div>
  );
}
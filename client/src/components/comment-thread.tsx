import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowUp, ArrowDown, MessageSquare, Flag, Shield, Flame, CornerDownRight, ChevronRight, MinusSquare, PlusSquare } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import CommentForm from "./comment-form";
import type { CommentWithUser } from "@shared/schema";

interface CommentThreadProps {
  postId: number;
}

interface CommentItemProps {
  comment: CommentWithUser;
  postId: number;
  level?: number;
}

function CommentItem({ comment, postId, level = 0 }: CommentItemProps) {
  // Añadir una clase para identificar nivel de anidación
  const nestingClass = `nesting-level-${level}`;
  const commentRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [replyOpen, setReplyOpen] = useState(false);
  const [liked, setLiked] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const isMobile = useIsMobile();
  
  // No usamos auto-scroll vertical por petición del usuario
  // Pero mantenemos la referencia para posibles mejoras futuras
  
  const likeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/likes", {
        commentId: comment.id
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/posts/${postId}/comments`] });
      setLiked(data.action === "added");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to like comment. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleLike = () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to like comments",
        variant: "destructive",
      });
      return;
    }
    
    likeMutation.mutate();
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
    <div ref={commentRef} className={`relative ${nestingClass} comment-item`}>
      {/* Indicador de nivel en dispositivos móviles (solo para niveles > 0) */}
      {isMobile && level > 0 && (
        <div className="flex items-center text-xs text-muted-foreground mb-1 ml-1">
          <CornerDownRight className="h-3 w-3 mr-1" />
          <span>Nivel {level}</span>
        </div>
      )}
    
      <div className="flex gap-3">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="bg-primary/20 text-primary">
            {comment.user.username.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap mb-1 gap-2">
            <a href={`/profile/${comment.user.id}`} className="font-medium text-primary hover:underline">
              {comment.user.username}
            </a>
            
            {comment.user.role === "admin" && (
              <Badge variant="outline" className="bg-success/20 text-success border-success/30">
                <Shield className="h-3 w-3 mr-1" /> Admin
              </Badge>
            )}
            
            {comment.user.role === "moderator" && (
              <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
                <Shield className="h-3 w-3 mr-1" /> Mod
              </Badge>
            )}
            
            <span className="text-xs text-success flex items-center">
              <Flame className="h-3 w-3 mr-1" />
              x{comment.user.likeMultiplier}
            </span>
            
            <span className="text-xs text-muted-foreground">•</span>
            
            <span className="text-xs text-muted-foreground">
              {timeAgo(new Date(comment.createdAt))}
            </span>
          </div>
          
          <p className="text-sm mb-2">{comment.content}</p>
          
          <div className="flex items-center text-xs text-muted-foreground">
            <div className="flex items-center mr-3">
              <Button 
                variant="ghost" 
                size="sm" 
                className={`px-1 py-0 h-auto ${liked ? 'text-success hover:text-success/80' : 'hover:text-success'}`}
                onClick={handleLike}
              >
                <ArrowUp className="h-4 w-4 mr-1" />
              </Button>
              <span>{comment.likes}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="px-1 py-0 h-auto hover:text-destructive"
              >
                <ArrowDown className="h-4 w-4 ml-1" />
              </Button>
            </div>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="px-1 py-0 h-auto hover:text-primary mr-3"
              onClick={() => setReplyOpen(!replyOpen)}
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              Reply
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="px-1 py-0 h-auto hover:text-primary"
            >
              <Flag className="h-4 w-4 mr-1" />
              Report
            </Button>
          </div>
          
          {replyOpen && (
            <div className="mt-3">
              <CommentForm 
                postId={postId} 
                parentId={comment.id} 
                onSuccess={() => setReplyOpen(false)}
              />
            </div>
          )}
          
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-4 relative comment-replies-container">
              {/* Control para dispositivos móviles - mostrar/ocultar respuestas */}
              {isMobile && (
                <div className="mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs flex items-center text-muted-foreground hover:text-primary w-full justify-start"
                    onClick={() => setExpanded(!expanded)}
                  >
                    {expanded ? (
                      <>
                        <MinusSquare className="h-3.5 w-3.5 mr-1" />
                        Ocultar {comment.replies.length} {comment.replies.length === 1 ? 'respuesta' : 'respuestas'}
                      </>
                    ) : (
                      <>
                        <PlusSquare className="h-3.5 w-3.5 mr-1" />
                        Mostrar {comment.replies.length} {comment.replies.length === 1 ? 'respuesta' : 'respuestas'}
                      </>
                    )}
                  </Button>
                </div>
              )}
              
              {/* Contenedor de respuestas - colapsable en móvil */}
              {(!isMobile || expanded) && (
                <div 
                  className={`space-y-4 nested-comment ${isMobile ? 'mobile-nested-comment' : 'pl-6'}`}
                  style={{ 
                    marginLeft: '0.5rem',
                    minWidth: 'calc(100% - 1rem)',
                  }}
                >
                  {comment.replies.map((reply) => (
                    <CommentItem 
                      key={reply.id} 
                      comment={reply} 
                      postId={postId}
                      level={(level + 1) % 13} // Usar módulo 13 para ciclar entre los 13 colores
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CommentThread({ postId }: CommentThreadProps) {
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
          <p className="text-xs text-muted-foreground">
            <ChevronRight className="h-3 w-3 inline mr-1" />
            Para comentarios anidados, usa el botón de mostrar/ocultar respuestas
          </p>
        </div>
      )}
      
      {/* Contenedor exterior que establece los límites */}
      <div className="space-y-6 comment-thread-container">
        {/* Contenedor interior que puede desbordarse horizontalmente */}
        <div className="comment-thread-main">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} postId={postId} />
          ))}
          
          {comments.length > 5 && (
            <Button 
              variant="outline" 
              className="w-full"
            >
              Show more comments
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

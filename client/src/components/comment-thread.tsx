import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  ArrowUp, 
  ArrowDown, 
  MessageSquare, 
  Flag, 
  Shield, 
  Flame,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [replyFormOpen, setReplyFormOpen] = useState(false);
  const [repliesVisible, setRepliesVisible] = useState(false);
  const [liked, setLiked] = useState(false);
  const [expanded, setExpanded] = useState(false);
  
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
    <div className="relative group transition-all duration-200 hover:bg-card/50 rounded-md p-2 -mx-2">
      <div className="flex gap-3">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="bg-primary/20 text-primary">
            {comment.user.username.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center mb-1 gap-x-2 gap-y-1">
            <a 
              href={`/profile/${comment.user.id}`} 
              className="font-medium text-primary hover:underline truncate max-w-full"
            >
              {comment.user.username}
            </a>
            
            {comment.user.role === "admin" && (
              <Badge variant="outline" className="bg-success/20 text-success border-success/30 flex-shrink-0">
                <Shield className="h-3 w-3 mr-1" /> Admin
              </Badge>
            )}
            
            {comment.user.role === "moderator" && (
              <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 flex-shrink-0">
                <Shield className="h-3 w-3 mr-1" /> Mod
              </Badge>
            )}
            
            <span className="text-xs text-success flex items-center whitespace-nowrap flex-shrink-0">
              <Flame className="h-3 w-3 mr-1" />
              x{comment.user.likeMultiplier}
            </span>
            
            <span className="text-xs text-muted-foreground hidden sm:inline">•</span>
            
            <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
              {timeAgo(new Date(comment.createdAt))}
            </span>
          </div>
          
          <div className="relative">
            {/* Mobile version with expand/collapse */}
            <div className="md:hidden">
              {expanded ? (
                <>
                  <div className="custom-scrollbar horizontal-scroll">
                    <p className="text-sm mb-2 break-words overflow-wrap-anywhere">{comment.content}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpanded(false)}
                    className="text-xs text-muted-foreground hover:text-primary mt-1 flex items-center px-1 py-0 h-auto"
                  >
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Colapsar
                  </Button>
                </>
              ) : (
                <>
                  <div className="custom-scrollbar horizontal-scroll">
                    <p className="text-sm mb-2 break-words overflow-wrap-anywhere line-clamp-2">
                      {comment.content}
                    </p>
                  </div>
                  {comment.content.length > 100 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpanded(true)}
                      className="text-xs text-muted-foreground hover:text-primary mt-1 flex items-center px-1 py-0 h-auto"
                    >
                      <ChevronDown className="h-3 w-3 mr-1" />
                      Ver más
                    </Button>
                  )}
                </>
              )}
            </div>
            
            {/* Desktop version with horizontal scroll */}
            <div className="hidden md:block overflow-x-auto horizontal-scroll custom-scrollbar">
              <p className="text-sm mb-2 break-words overflow-wrap-anywhere">{comment.content}</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center text-xs text-muted-foreground gap-2">
            <div className="flex items-center">
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
              className="px-1 py-0 h-auto hover:text-primary"
              onClick={() => setReplyFormOpen(!replyFormOpen)}
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              Responder
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="px-1 py-0 h-auto hover:text-primary"
            >
              <Flag className="h-4 w-4 mr-1" />
              Reportar
            </Button>
          </div>
          
          {replyFormOpen && (
            <div className="mt-3">
              <CommentForm 
                postId={postId} 
                parentId={comment.id} 
                onSuccess={() => setReplyFormOpen(false)}
              />
            </div>
          )}
          
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRepliesVisible(!repliesVisible)}
                className="text-xs text-muted-foreground hover:text-primary flex items-center px-2 py-1 h-auto mb-2"
              >
                {repliesVisible ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Ocultar {comment.replies.length} {comment.replies.length === 1 ? 'respuesta' : 'respuestas'}
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    Ver {comment.replies.length} {comment.replies.length === 1 ? 'respuesta' : 'respuestas'}
                  </>
                )}
              </Button>

              {repliesVisible && level < 3 && (
                <div className="replies-container custom-scrollbar">
                  <div 
                    className={`space-y-4 nested-reply-level-${Math.min(level + 1, 6)}`}
                    style={{ 
                      marginLeft: 0,
                      paddingRight: 0
                    }}
                  >
                    {comment.replies.map((reply) => (
                      <CommentItem 
                        key={reply.id} 
                        comment={reply} 
                        postId={postId}
                        level={level + 1}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {/* Visualización alternativa para comentarios muy anidados */}
              {repliesVisible && level >= 3 && (
                <div className="mt-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="flex items-center justify-center gap-1 text-sm w-full"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Ver respuestas en ventana completa
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-lg font-medium">
                          Respuestas ({comment.replies.length})
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="border-b pb-4 last:border-b-0 last:pb-0">
                            <div className="flex gap-3">
                              <Avatar className="h-8 w-8 flex-shrink-0">
                                <AvatarFallback className="bg-primary/20 text-primary">
                                  {reply.user.username.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center mb-1 gap-x-2 gap-y-1">
                                  <span className="font-medium text-primary">
                                    {reply.user.username}
                                  </span>
                                  
                                  {reply.user.role === "admin" && (
                                    <Badge variant="outline" className="bg-success/20 text-success border-success/30">
                                      <Shield className="h-3 w-3 mr-1" /> Admin
                                    </Badge>
                                  )}
                                  
                                  <span className="text-xs text-success flex items-center">
                                    <Flame className="h-3 w-3 mr-1" />
                                    x{reply.user.likeMultiplier}
                                  </span>
                                  
                                  <span className="text-xs text-muted-foreground">
                                    {timeAgo(new Date(reply.createdAt))}
                                  </span>
                                </div>
                                
                                <p className="text-sm mb-2">{reply.content}</p>
                                
                                <div className="flex items-center text-xs text-muted-foreground gap-2">
                                  <div className="flex items-center">
                                    <Button variant="ghost" size="sm" className="px-1 py-0 h-auto hover:text-success">
                                      <ArrowUp className="h-4 w-4 mr-1" />
                                    </Button>
                                    <span>{reply.likes}</span>
                                    <Button variant="ghost" size="sm" className="px-1 py-0 h-auto hover:text-destructive">
                                      <ArrowDown className="h-4 w-4 ml-1" />
                                    </Button>
                                  </div>
                                </div>
                                
                                {reply.replies && reply.replies.length > 0 && (
                                  <div className="mt-3 ml-4 pl-4 border-l-2 border-primary/20">
                                    <Button
                                      variant="link"
                                      size="sm"
                                      className="p-0 h-auto mb-2 text-primary"
                                    >
                                      Ver {reply.replies.length} respuestas más
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
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

  if (isLoading) {
    return (
      <div className="text-center py-4">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
        <p className="mt-2 text-sm text-muted-foreground">Cargando comentarios...</p>
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-muted-foreground">Aún no hay comentarios. ¡Sé el primero en comentar!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {comments.map((comment) => (
        <CommentItem key={comment.id} comment={comment} postId={postId} />
      ))}
      
      {comments.length > 5 && (
        <Button 
          variant="outline" 
          className="w-full flex items-center justify-center gap-1"
        >
          <ChevronDown className="h-4 w-4" />
          Ver más comentarios
        </Button>
      )}
    </div>
  );
}

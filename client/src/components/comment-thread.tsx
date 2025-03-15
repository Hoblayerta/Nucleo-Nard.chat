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
  ExternalLink,
  GitBranch,
  GitMerge,
  BarChart3,
  TreeDeciduous,
  List
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  const [repliesVisible, setRepliesVisible] = useState(level < 2);
  const [liked, setLiked] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // Estado para el modal de respuesta
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  // Función recursiva para renderizar respuestas en modales
  const renderNestedReplies = (r: CommentWithUser) => {
    return (
      <div key={r.id} className="border-b pb-4 last:border-b-0 last:pb-0">
        <div className="flex gap-3">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarFallback className="bg-primary/20 text-primary">
              {r.user.username.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex flex-wrap items-center mb-1 gap-x-2 gap-y-1">
              <span className="font-medium text-primary">
                {r.user.username}
              </span>
              {r.user.role === "admin" && (
                <Badge variant="outline" className="bg-success/20 text-success border-success/30">
                  <Shield className="h-3 w-3 mr-1" /> Admin
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {timeAgo(new Date(r.createdAt))}
              </span>
            </div>
            <p className="text-sm mb-2">{r.content}</p>
            <div className="flex items-center text-xs text-muted-foreground gap-2">
              <div className="flex items-center">
                <Button variant="ghost" size="sm" className="px-1 py-0 h-auto hover:text-success">
                  <ArrowUp className="h-4 w-4 mr-1" />
                </Button>
                <span>{r.likes}</span>
              </div>
              
              {/* Modal anidado para responder */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="px-1 py-0 h-auto hover:text-primary">
                    <MessageSquare className="h-4 w-4 mr-1" />
                    Responder
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-medium">
                      Responder a {r.user.username}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">
                      Tu respuesta aparecerá en la conversación
                    </p>
                  </DialogHeader>
                  
                  {/* Comentario original */}
                  <div className="border-b pb-4 mb-4">
                    <div className="flex gap-3">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {r.user.username.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm mb-2">{r.content}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Formulario de respuesta */}
                  <CommentForm 
                    postId={postId} 
                    parentId={r.id}
                    onSuccess={() => {
                      queryClient.invalidateQueries({ queryKey: [`/api/posts/${postId}/comments`] });
                    }}
                  />
                </DialogContent>
              </Dialog>
            </div>
            
            {/* Respuestas anidadas */}
            {r.replies && r.replies.length > 0 && (
              <div className="mt-3 ml-4 pl-4 border-l-2 border-primary/10">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      variant="link" 
                      className="flex items-center p-0 text-primary hover:text-primary/80 h-6 text-xs"
                    >
                      <ChevronDown className="h-3 w-3 mr-1" />
                      Ver {r.replies.length} {r.replies.length === 1 ? 'respuesta' : 'respuestas'} más
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-medium">
                        Conversación con {r.user.username}
                      </DialogTitle>
                      <p className="text-sm text-muted-foreground">
                        Ver todas las respuestas a este comentario
                      </p>
                    </DialogHeader>

                    {/* Formulario de respuesta */}
                    <CommentForm 
                      postId={postId} 
                      parentId={r.id}
                      onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: [`/api/posts/${postId}/comments`] });
                      }}
                    />
                    
                    <div className="space-y-4 mt-4">
                      {r.replies.map(nestedReply => renderNestedReplies(nestedReply))}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
  
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
              {/* Estilo de Facebook/Instagram: Solo un nivel visible directamente */}
              {level < 2 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRepliesVisible(!repliesVisible)}
                    className="text-xs text-primary hover:text-primary/80 flex items-center px-0 py-1 h-auto mb-2"
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

                  {repliesVisible && (
                    <div className="replies-container custom-scrollbar">
                      <div className="space-y-4 nested-reply-level-1 pl-3">
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
                </>
              )}
              
              {/* Nivel 2+ - Usar un enfoque tipo Facebook con botón especial */}
              {level >= 2 && (
                <div className="mt-2">
                  <Dialog open={replyModalOpen} onOpenChange={setReplyModalOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="link" 
                        className="flex items-center p-0 text-primary hover:text-primary/80 h-6 text-xs"
                      >
                        <TreeDeciduous className="h-3 w-3 mr-1" />
                        Ver árbol de conversación ({comment.replies.length})
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[800px] sm:max-h-[85vh] overflow-auto">
                      <DialogHeader>
                        <DialogTitle className="text-lg font-medium">
                          Árbol de conversación: Respuestas a {comment.user.username}
                        </DialogTitle>
                        <DialogDescription>
                          Explora los diferentes hilos de la conversación y encuentra las respuestas más populares
                        </DialogDescription>
                      </DialogHeader>

                      {/* Tabs para diferentes visualizaciones */}
                      <Tabs defaultValue="tree" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                          <TabsTrigger value="tree" className="flex items-center gap-1">
                            <TreeDeciduous className="h-4 w-4" />
                            <span className="hidden sm:inline">Árbol</span>
                          </TabsTrigger>
                          <TabsTrigger value="flat" className="flex items-center gap-1">
                            <List className="h-4 w-4" />
                            <span className="hidden sm:inline">Lista</span>
                          </TabsTrigger>
                          <TabsTrigger value="popular" className="flex items-center gap-1">
                            <BarChart3 className="h-4 w-4" />
                            <span className="hidden sm:inline">Populares</span>
                          </TabsTrigger>
                        </TabsList>
                        
                        {/* Vista de árbol - Dibuja un árbol visual de la conversación */}
                        <TabsContent value="tree" className="pt-4">
                          <div className="border-b pb-4 mb-4">
                            <div className="flex gap-3">
                              <Avatar className="h-8 w-8 flex-shrink-0">
                                <AvatarFallback className="bg-primary/20 text-primary">
                                  {comment.user.username.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              
                              <div className="flex-1">
                                <p className="text-sm mb-2 font-medium">{comment.content}</p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="conversation-tree relative">
                            <div className="pl-8 space-y-4 relative mb-6">
                              {/* Indicaciones de navegación */}
                              <div className="absolute -top-6 left-0 text-xs text-muted-foreground flex items-center gap-2">
                                <span className="flex items-center">
                                  <ArrowUp className="h-3 w-3 mr-1 text-success" />
                                  Más votado
                                </span>
                                <span className="flex items-center">
                                  <div className="h-3 w-3 bg-blue-400/30 rounded-full mr-1"></div>
                                  Diferentes ramas
                                </span>
                              </div>
                              
                              {/* Línea vertical principal */}
                              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-primary/20"></div>
                              
                              {comment.replies
                                .sort((a, b) => b.likes - a.likes) // Ordenar por likes primero
                                .map((reply, index) => (
                                <div key={reply.id} className="relative branch-node">
                                  {/* Línea horizontal hacia el nodo */}
                                  <div className="absolute left-[-16px] top-4 w-4 h-0.5 branch-connector"></div>
                                  
                                  <div className="p-3 border rounded-md shadow-sm hover:shadow-md transition-all duration-200">
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                      <Avatar className="h-6 w-6">
                                        <AvatarFallback className="text-xs">
                                          {reply.user.username.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="font-medium text-sm">{reply.user.username}</span>
                                      {reply.user.role === "admin" && (
                                        <Badge variant="outline" className="bg-success/20 text-success border-success/30 text-xs">
                                          <Shield className="h-3 w-3 mr-1" /> Admin
                                        </Badge>
                                      )}
                                      <Badge variant="outline" className={`text-xs px-1 py-0 h-5 
                                        ${reply.likes > 3 ? 'bg-green-100 text-green-700 border-green-300' : 
                                         reply.likes > 0 ? 'bg-blue-100 text-blue-700 border-blue-300' : 
                                         'bg-primary/5'}`}>
                                        {reply.likes} <ArrowUp className="h-3 w-3 ml-1" />
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">
                                        {timeAgo(new Date(reply.createdAt))}
                                      </span>
                                    </div>
                                    
                                    <p className="text-sm mb-2">{reply.content}</p>
                                    
                                    <div className="flex gap-2 justify-between items-center">
                                      <div className="flex items-center gap-2 text-xs">
                                        <div className="flex items-center gap-1">
                                          <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="px-1 py-0 h-auto hover:text-success"
                                            onClick={() => handleLike()}
                                          >
                                            <ArrowUp className="h-4 w-4" />
                                          </Button>
                                          <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="px-1 py-0 h-auto hover:text-destructive"
                                          >
                                            <ArrowDown className="h-4 w-4" />
                                          </Button>
                                        </div>
                                        
                                        <Dialog>
                                          <DialogTrigger asChild>
                                            <Button 
                                              variant="ghost" 
                                              size="sm" 
                                              className="px-1 py-0 h-auto hover:text-primary text-primary/80"
                                            >
                                              <MessageSquare className="h-4 w-4 mr-1" />
                                              Responder
                                            </Button>
                                          </DialogTrigger>
                                          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                                            <DialogHeader>
                                              <DialogTitle>Responder a {reply.user.username}</DialogTitle>
                                              <DialogDescription>Tu respuesta aparecerá como una rama en la conversación</DialogDescription>
                                            </DialogHeader>
                                            
                                            {/* Comentario original */}
                                            <div className="border-b pb-4 mb-4">
                                              <div className="flex gap-3">
                                                <Avatar className="h-8 w-8 flex-shrink-0">
                                                  <AvatarFallback className="bg-primary/20 text-primary">
                                                    {reply.user.username.substring(0, 2).toUpperCase()}
                                                  </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1">
                                                  <p className="text-sm mb-2">{reply.content}</p>
                                                </div>
                                              </div>
                                            </div>
                                            
                                            {/* Formulario de respuesta */}
                                            <CommentForm 
                                              postId={postId} 
                                              parentId={reply.id}
                                              onSuccess={() => {
                                                queryClient.invalidateQueries({ queryKey: [`/api/posts/${postId}/comments`] });
                                              }}
                                            />
                                          </DialogContent>
                                        </Dialog>
                                      </div>
                                      
                                      {reply.replies && reply.replies.length > 0 && (
                                        <Dialog>
                                          <DialogTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-7 text-xs">
                                              <GitBranch className="h-3 w-3 mr-1" />
                                              {reply.replies.length} {reply.replies.length === 1 ? 'respuesta' : 'respuestas'}
                                            </Button>
                                          </DialogTrigger>
                                          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                                            <DialogHeader>
                                              <DialogTitle>Respuestas a {reply.user.username}</DialogTitle>
                                              <DialogDescription>Continúa la conversación</DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-4">
                                              {reply.replies.map(r => renderNestedReplies(r))}
                                            </div>
                                          </DialogContent>
                                        </Dialog>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TabsContent>
                        
                        {/* Vista plana - Lista simple de todas las respuestas */}
                        <TabsContent value="flat" className="pt-4">
                          <div className="space-y-4">
                            {/* Comentario principal */}
                            <div className="border-b pb-4 mb-4">
                              <div className="flex gap-3">
                                <Avatar className="h-8 w-8 flex-shrink-0">
                                  <AvatarFallback className="bg-primary/20 text-primary">
                                    {comment.user.username.substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium">{comment.user.username}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {timeAgo(new Date(comment.createdAt))}
                                    </span>
                                  </div>
                                  <p className="text-sm mb-2">{comment.content}</p>
                                </div>
                              </div>
                            </div>
                            
                            {/* Formulario de respuesta */}
                            <div className="mb-4">
                              <CommentForm 
                                postId={postId} 
                                parentId={comment.id}
                                onSuccess={() => {
                                  queryClient.invalidateQueries({ queryKey: [`/api/posts/${postId}/comments`] });
                                }}
                              />
                            </div>
                            
                            {/* Respuestas recursivas */}
                            {comment.replies.map(reply => renderNestedReplies(reply))}
                          </div>
                        </TabsContent>
                        
                        {/* Vista de populares - Ordenadas por likes */}
                        <TabsContent value="popular" className="pt-4">
                          <div className="space-y-4">
                            <div className="border-b pb-4 mb-4">
                              <h3 className="font-medium text-sm mb-2">Respuestas más populares</h3>
                              <p className="text-xs text-muted-foreground">Ordenadas por número de likes</p>
                            </div>

                            {/* Respuestas ordenadas por popularidad */}
                            {[...comment.replies]
                              .sort((a, b) => b.likes - a.likes)
                              .map((reply, idx) => (
                                <div key={reply.id} className={`border p-3 rounded-md shadow-sm hover:shadow-md transition-all duration-200 flex gap-3 ${idx === 0 ? 'border-green-300 bg-green-50/50' : ''}`}>
                                  <div className="flex-shrink-0 flex flex-col items-center justify-start">
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className={`px-1 py-0 h-auto ${idx === 0 ? 'text-green-600' : 'text-green-500'}`}
                                      onClick={() => handleLike()}
                                    >
                                      <ArrowUp className="h-5 w-5" />
                                    </Button>
                                    <span className={`font-semibold text-lg ${idx === 0 ? 'text-green-600' : ''}`}>{reply.likes}</span>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="px-1 py-0 h-auto text-muted-foreground hover:text-destructive"
                                    >
                                      <ArrowDown className="h-5 w-5" />
                                    </Button>
                                  </div>
                                  
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Avatar className="h-6 w-6">
                                        <AvatarFallback className="text-xs">
                                          {reply.user.username.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="font-medium text-sm">{reply.user.username}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {timeAgo(new Date(reply.createdAt))}
                                      </span>
                                    </div>
                                    
                                    <p className="text-sm mb-2">{reply.content}</p>
                                    
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Dialog>
                                          <DialogTrigger asChild>
                                            <Button 
                                              variant="outline" 
                                              size="sm" 
                                              className="h-7 text-xs"
                                            >
                                              <MessageSquare className="h-3 w-3 mr-1" />
                                              Responder
                                            </Button>
                                          </DialogTrigger>
                                          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                                            <DialogHeader>
                                              <DialogTitle>Responder a {reply.user.username}</DialogTitle>
                                              <DialogDescription>Tu respuesta aparecerá como una rama en la conversación</DialogDescription>
                                            </DialogHeader>
                                            
                                            {/* Comentario original */}
                                            <div className="border-b pb-4 mb-4">
                                              <div className="flex gap-3">
                                                <Avatar className="h-8 w-8 flex-shrink-0">
                                                  <AvatarFallback className="bg-primary/20 text-primary">
                                                    {reply.user.username.substring(0, 2).toUpperCase()}
                                                  </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1">
                                                  <p className="text-sm mb-2">{reply.content}</p>
                                                </div>
                                              </div>
                                            </div>
                                            
                                            {/* Formulario de respuesta */}
                                            <CommentForm 
                                              postId={postId} 
                                              parentId={reply.id}
                                              onSuccess={() => {
                                                queryClient.invalidateQueries({ queryKey: [`/api/posts/${postId}/comments`] });
                                              }}
                                            />
                                          </DialogContent>
                                        </Dialog>
                                        
                                        <div className="flex items-center text-muted-foreground text-xs">
                                          <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="px-1 py-0 h-auto hover:text-destructive"
                                          >
                                            <ArrowDown className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                      
                                      {reply.replies && reply.replies.length > 0 && (
                                        <Dialog>
                                          <DialogTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-7 text-xs flex items-center gap-1">
                                              <GitBranch className="h-3 w-3" />
                                              Ver {reply.replies.length} 
                                              <span className="hidden sm:inline">
                                                {reply.replies.length === 1 ? 'respuesta' : 'respuestas'}
                                              </span>
                                            </Button>
                                          </DialogTrigger>
                                          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                                            <DialogHeader>
                                              <DialogTitle>Respuestas a {reply.user.username}</DialogTitle>
                                              <DialogDescription>Continúa la conversación</DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-4">
                                              {reply.replies.map(r => renderNestedReplies(r))}
                                            </div>
                                          </DialogContent>
                                        </Dialog>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </TabsContent>
                      </Tabs>
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

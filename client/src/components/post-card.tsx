import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { 
  ArrowUp,
  ArrowDown,
  MessageSquare,
  Bookmark,
  Share2,
  Shield,
  Maximize2,
  Minimize2
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import CommentThread from "./comment-thread";
import CommentForm from "./comment-form";
import type { PostWithDetails } from "@shared/schema";

interface PostCardProps {
  post: PostWithDetails;
}

export default function PostCard({ post }: PostCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Determina si el usuario ha votado en este post
  const userVoteStatus = post.userVote || null;
  
  // Efecto para añadir manejadores de eventos a las imágenes
  useEffect(() => {
    if (!contentRef.current) return;
    
    const images = contentRef.current.querySelectorAll('img');
    
    const handleImageClick = (e: Event) => {
      const img = e.target as HTMLImageElement;
      img.classList.toggle('expanded');
    };
    
    // Añadir manejadores de eventos a todas las imágenes
    images.forEach(img => {
      img.addEventListener('click', handleImageClick);
    });
    
    // Limpiar manejadores de eventos al desmontar
    return () => {
      images.forEach(img => {
        img.removeEventListener('click', handleImageClick);
      });
    };
  }, [post.content]);
  
  const voteMutation = useMutation({
    mutationFn: async ({ isUpvote }: { isUpvote: boolean }) => {
      const res = await apiRequest("POST", "/api/votes", {
        postId: post.id,
        isUpvote
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to vote on post. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleVote = (isUpvote: boolean) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to vote on posts",
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
    <Card className="bg-card overflow-hidden post-listing d-flex position-relative">
      <CardContent className="p-0">
        <div className="p-4">
          <div className="d-flex">
            {/* Columna izquierda - votos (estilo Lemmy) */}
            <div className="vote-bar text-center mr-3">
              <Button 
                size="sm" 
                variant="ghost" 
                className={`upvote p-0 h-7 w-7 ${userVoteStatus === 'upvote' ? 'text-success hover:text-success/80' : 'text-muted-foreground hover:text-success'}`} 
                onClick={() => handleVote(true)}
                disabled={voteMutation.isPending}
                aria-label="Upvote"
                aria-pressed={userVoteStatus === 'upvote'}
              >
                <ArrowUp className="h-5 w-5" />
              </Button>
              <div className="unselectable pointer score font-medium">{post.voteScore || 0}</div>
              <Button 
                size="sm" 
                variant="ghost" 
                className={`downvote p-0 h-7 w-7 ${userVoteStatus === 'downvote' ? 'text-destructive hover:text-destructive/80' : 'text-muted-foreground hover:text-destructive'}`}
                onClick={() => handleVote(false)}
                disabled={voteMutation.isPending}
                aria-label="Downvote"
                aria-pressed={userVoteStatus === 'downvote'}
              >
                <ArrowDown className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Columna principal - contenido del post */}
            <div className="flex-1">
              {/* Encabezado del post */}
              <div className="post-title mb-2">
                <h2 className="text-xl font-medium hover:underline post-title">{post.title}</h2>
              </div>
              
              {/* Metadata del post - estilo Lemmy */}
              <div className="mb-2 text-sm text-muted-foreground post-metadata">
                <div className="d-flex flex-wrap align-items-center">
                  {post.user.role === "admin" && (
                    <Badge variant="outline" className="bg-success/20 text-success border-success/30 mr-2">
                      <Shield className="h-3 w-3 mr-1" /> Admin
                    </Badge>
                  )}
                  
                  <span className="mr-1">Posted by</span>
                  <a href={`/profile/${post.user.id}`} className="text-primary hover:underline mr-1">
                    {post.user.username}
                  </a>
                  <span className="mx-1">•</span>
                  <span>{timeAgo(new Date(post.createdAt))}</span>
                </div>
              </div>
              
              {/* Contenido del post - imágenes con estilo Lemmy */}
              <div className="post-body mb-3">
                <div 
                  ref={contentRef}
                  className="md-div overflow-wrap-anywhere"
                  dangerouslySetInnerHTML={{ __html: post.content }} 
                />
                <div className="text-xs text-muted-foreground mt-2 italic">
                  <span>Haz clic en las imágenes para ampliarlas</span>
                </div>
              </div>
              
              {/* Barra de acciones - estilo Lemmy */}
              <div className="post-actions d-flex flex-wrap text-xs text-muted-foreground">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="pointer mr-3 p-0 h-7"
                  onClick={() => setShowComments(!showComments)}
                >
                  <MessageSquare className="h-4 w-4 mr-1" />
                  <span>{post.comments} comment{post.comments !== 1 ? 's' : ''}</span>
                  {showComments && <Minimize2 className="h-4 w-4 ml-1" />}
                  {!showComments && <Maximize2 className="h-4 w-4 ml-1" />}
                </Button>
                
                <Button variant="ghost" size="sm" className="pointer mr-3 p-0 h-7">
                  <Bookmark className="h-4 w-4 mr-1" />
                  <span>Save</span>
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="pointer p-0 h-7"
                  onClick={() => {
                    const url = `${window.location.origin}/posts/${post.id}`;
                    navigator.clipboard.writeText(url).then(() => {
                      toast({
                        title: "Link copied!",
                        description: "Post link has been copied to clipboard."
                      });
                    });
                  }}
                >
                  <Share2 className="h-4 w-4 mr-1" />
                  <span>Share</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Sección de comentarios - estilo Lemmy */}
        {showComments && (
          <div className="comments-section border-t border-muted">
            <div className="p-4 mb-0 bg-background">
              <CommentForm postId={post.id} />
            </div>
            
            <div className="p-4 pt-0 bg-background">
              <CommentThread postId={post.id} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

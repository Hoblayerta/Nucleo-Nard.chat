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
    <Card className="bg-card overflow-hidden">
      <CardContent className="p-0">
        <div className="p-4">
          <div className="flex items-start">
            <div className="flex flex-col items-center mr-4 space-y-1">
              <Button 
                size="sm" 
                variant="ghost" 
                className={`p-0 h-8 w-8 rounded-full ${userVoteStatus === 'upvote' ? 'text-success hover:text-success/80' : 'text-muted-foreground hover:text-success'}`} 
                onClick={() => handleVote(true)}
                disabled={voteMutation.isPending}
              >
                <ArrowUp className="h-5 w-5" />
              </Button>
              <span className="font-medium">{post.voteScore || 0}</span>
              <Button 
                size="sm" 
                variant="ghost" 
                className={`p-0 h-8 w-8 rounded-full ${userVoteStatus === 'downvote' ? 'text-destructive hover:text-destructive/80' : 'text-muted-foreground hover:text-destructive'}`}
                onClick={() => handleVote(false)}
                disabled={voteMutation.isPending}
              >
                <ArrowDown className="h-5 w-5" />
              </Button>
            </div>
            
            <div className="flex-1">
              <div className="flex items-center text-sm text-muted-foreground mb-2">
                {post.user.role === "admin" && (
                  <Badge variant="outline" className="bg-success/20 text-success border-success/30 mr-2">
                    <Shield className="h-3 w-3 mr-1" /> Admin
                  </Badge>
                )}
                
                <span>Posted by</span>
                <a href={`/profile/${post.user.id}`} className="text-primary hover:underline mx-1">
                  {post.user.username}
                </a>
                <span className="mx-1">•</span>
                <span>{timeAgo(new Date(post.createdAt))}</span>
              </div>
              
              <h2 className="text-xl font-medium mb-2">{post.title}</h2>
              
              <div className="prose prose-sm dark:prose-invert max-w-none mb-4">
                <div 
                  ref={contentRef}
                  dangerouslySetInnerHTML={{ __html: post.content }} 
                />
                <div className="text-xs text-muted-foreground mt-2 italic">
                  <span>Haz clic en las imágenes para ampliarlas</span>
                </div>
              </div>
              
              <div className="flex items-center text-sm text-muted-foreground">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="hover:text-primary mr-4"
                  onClick={() => setShowComments(!showComments)}
                >
                  <MessageSquare className="h-4 w-4 mr-1" />
                  <span>{post.comments} comment{post.comments !== 1 ? 's' : ''}</span>
                </Button>
                
                <Button variant="ghost" size="sm" className="hover:text-primary mr-4">
                  <Bookmark className="h-4 w-4 mr-1" />
                  <span>Save</span>
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="hover:text-primary"
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
        
        {showComments && (
          <>
            <Separator />
            
            <div className="bg-background p-4 border-t border-border">
              <CommentForm postId={post.id} />
            </div>
            
            <Separator />
            
            <div className="bg-background p-4 border-t border-border">
              <h3 className="font-medium mb-4">Comments ({post.comments})</h3>
              <CommentThread postId={post.id} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

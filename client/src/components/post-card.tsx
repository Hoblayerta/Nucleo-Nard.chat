import { useState } from "react";
import { format } from "date-fns";
import { 
  ArrowUp,
  ArrowDown,
  MessageSquare,
  Bookmark,
  Share2,
  Shield
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
  const [liked, setLiked] = useState(false);
  
  const likeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/likes", {
        postId: post.id
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      setLiked(data.action === "added");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to like post. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleLike = () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to like posts",
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
    <Card className="bg-card overflow-hidden">
      <CardContent className="p-0">
        <div className="p-4">
          <div className="flex items-start">
            <div className="flex flex-col items-center mr-4 space-y-1">
              <Button 
                size="sm" 
                variant="ghost" 
                className={`p-0 h-8 w-8 rounded-full ${liked ? 'text-success hover:text-success/80' : 'text-muted-foreground hover:text-success'}`} 
                onClick={handleLike}
              >
                <ArrowUp className="h-5 w-5" />
              </Button>
              <span className="font-medium">{post.likes}</span>
              <Button 
                size="sm" 
                variant="ghost" 
                className="p-0 h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
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
                <p>{post.content}</p>
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
                
                <Button variant="ghost" size="sm" className="hover:text-primary">
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

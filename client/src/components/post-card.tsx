import { useState } from "react";
import { format } from "date-fns";
import { 
  ArrowUp,
  ArrowDown,
  MessageSquare,
  Bookmark,
  Share2,
  Shield,
  FileSpreadsheet
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import CommentThread from "./comment-thread";
import CommentForm from "./comment-form";
import BadgeIcon from "./badge-icon";
import PostBoard from "./post-board";
import CommentTreeView from "./comment-tree-view";
import type { PostWithDetails } from "@shared/schema";
import { Switch } from "@/components/ui/switch"; // Import the Switch component


interface PostCardProps {
  post: PostWithDetails;
}

export default function PostCard({ post }: PostCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [showPostBoard, setShowPostBoard] = useState(false);
  const [showCommentTree, setShowCommentTree] = useState(false);

  // Determina si el usuario ha votado en este post
  const userVoteStatus = post.userVote || null;

  const voteMutation = useMutation({
    mutationFn: async ({ isUpvote }: { isUpvote: boolean }) => {
      const res = await apiRequest("POST", "/api/votes", {
        postId: post.id,
        voteType: isUpvote ? 'upvote' : 'downvote'
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
    if (post.frozen) {
      toast({
        title: "Post bloqueado",
        description: "No se pueden realizar votos en un post congelado",
        variant: "destructive",
      });
      return;
    }
    
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

  const handleFreeze = async (frozen: boolean) => {
    try {
      await apiRequest("PUT", `/api/posts/${post.id}/freeze`, { frozen });
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    } catch (error) {
      console.error("Error freezing/unfreezing post:", error);
      toast({
        title: "Error",
        description: "Failed to update post status. Please try again.",
        variant: "destructive",
      });
    }
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
                disabled={voteMutation.isPending || post.frozen} // Disable if frozen
              >
                <ArrowUp className="h-5 w-5" />
              </Button>
              <span className="font-medium">{post.voteScore || 0}</span>
              <Button 
                size="sm" 
                variant="ghost" 
                className={`p-0 h-8 w-8 rounded-full ${userVoteStatus === 'downvote' ? 'text-destructive hover:text-destructive/80' : 'text-muted-foreground hover:text-destructive'}`}
                onClick={() => handleVote(false)}
                disabled={voteMutation.isPending || post.frozen} // Disable if frozen
              >
                <ArrowDown className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1">
              <div className="flex md:items-center text-sm text-muted-foreground mb-2 flex-wrap md:flex-nowrap">
                <div className="flex items-center w-full md:w-auto">
                  {post.user.role === "admin" && (
                    <Badge variant="outline" className="bg-success/20 text-success border-success/30 mr-2">
                      <Shield className="h-3 w-3 mr-1" /> Admin
                    </Badge>
                  )}
                  {post.user.role === "moderator" && (
                    <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 mr-2">
                      <Shield className="h-3 w-3 mr-1" /> Mod
                    </Badge>
                  )}

                  <span className="hidden md:inline">Posted by</span>
                  <span className="md:hidden">Por:</span>
                  <a href={`/profile/${post.user.id}`} className="text-primary hover:underline mx-1 font-medium">
                    {post.user.username}
                  </a>
                  
                  {post.user.badges && post.user.badges.length > 0 && (
                    <span className="inline-flex items-center ml-1">
                      {post.user.badges.map((badge, idx) => (
                        <BadgeIcon key={`${post.id}-${badge}-${idx}`} badge={badge} size={14} />
                      ))}
                    </span>
                  )}
                </div>
                
                <div className="w-full md:w-auto md:ml-1 text-xs md:text-sm text-muted-foreground/80 md:flex md:items-center">
                  <span className="md:hidden"></span>
                  <span className="hidden md:inline">•</span>
                  <span className="flex items-center">
                    {timeAgo(new Date(post.createdAt))}
                  </span>
                </div>
              </div>

              <h2 className="text-xl font-medium mb-2">{post.title}</h2>

              <div className="prose prose-sm dark:prose-invert max-w-none mb-4">
                <div dangerouslySetInnerHTML={{ __html: post.content }} />
              </div>

              <div className="flex items-center text-sm text-muted-foreground flex-wrap">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="hover:text-primary mr-2 md:mr-4 h-8 px-2 md:px-3"
                  onClick={() => setShowComments(!showComments)}
                >
                  <MessageSquare className="h-4 w-4 mr-1" />
                  <span className="md:inline">
                    {post.comments} <span className="hidden md:inline">comment{post.comments !== 1 ? 's' : ''}</span>
                  </span>
                </Button>

                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="hover:text-primary mr-2 md:mr-4 h-8 px-2 md:px-3"
                >
                  <Bookmark className="h-4 w-4 mr-1" />
                  <span className="md:inline">Save</span>
                </Button>

                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="hover:text-primary mr-2 md:mr-4 h-8 px-2 md:px-3"
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
                  <span className="md:inline">Share</span>
                </Button>

                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="hover:text-primary mr-2 md:mr-4 h-8 px-2 md:px-3"
                  onClick={() => setShowPostBoard(true)}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-1" />
                  <span className="md:inline">Post Board</span>
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="hover:text-primary mr-2 md:mr-4 h-8 px-2 md:px-3"
                  onClick={() => setShowCommentTree(true)}
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="h-4 w-4 mr-1"
                  >
                    <path d="M8 3v4h1a2 2 0 0 1 2 2v2" />
                    <path d="M12 19v-2a2 2 0 0 0-2-2H8" />
                    <path d="M4 9h1a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h2" />
                    <path d="M16 3v4h-1a2 2 0 0 0-2 2v2" />
                    <path d="M16 21v-4h1a2 2 0 0 0 2-2v-2" />
                    <path d="M20 9h-1a2 2 0 0 0-2 2v2a2 2 0 0 1-2 2h-2" />
                  </svg>
                  <span className="md:inline">Ver Árbol</span>
                </Button>
                


                {(user?.role === "admin" || user?.role === "moderator") && (
                  <>
                    <a 
                      href={`/api/posts/${post.id}/comments/export-text`}
                      download={`post-${post.id}-${post.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.txt`}
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:text-primary h-8 px-2 md:px-3 mr-2 md:mr-4"
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-1" />
                      <span className="md:inline">Texto</span>
                    </a>

                    <a 
                      href={`/api/posts/${post.id}/comments/export-word`}
                      download={`post-${post.id}-${post.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.docx`}
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:text-primary h-8 px-2 md:px-3 mr-2 md:mr-4"
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-1" />
                      <span className="md:inline">Word</span>
                    </a>
                  </>
                )}

                {(user?.role === "admin" || user?.role === "moderator") && (
                  <div className="flex items-center space-x-1 md:space-x-2 ml-auto mr-0">
                    <Switch
                      checked={post.frozen}
                      onCheckedChange={handleFreeze}
                      aria-label="Freeze post interactions"
                    />
                    <span className="text-xs md:text-sm text-muted-foreground">
                      {post.frozen ? "Block" : "Unblock"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {showComments && (
          <>
            <Separator />

            <div className="bg-background p-4 border-t border-border">
              <CommentForm postId={post.id} isFrozen={post.frozen}/>
            </div>

            <Separator />

            <div className="bg-background p-4 border-t border-border">
              <h3 className="font-medium mb-4">Comments ({post.comments})</h3>
              <CommentThread postId={post.id} isFrozen={post.frozen} />
            </div>
          </>
        )}
      </CardContent>
      
      {/* Post Board componente (tabla tipo Excel) */}
      <PostBoard 
        postId={post.id} 
        isOpen={showPostBoard} 
        onClose={() => setShowPostBoard(false)} 
      />
      
      {/* Árbol de comentarios */}
      {showCommentTree && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card p-4 rounded-lg shadow-lg w-full max-w-4xl h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Árbol de Comentarios</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                className="p-1 h-8 w-8" 
                onClick={() => setShowCommentTree(false)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>
                </svg>
              </Button>
            </div>
            <div className="flex-1 relative overflow-hidden">
              <CommentTreeView 
                postId={post.id} 
                onClose={() => setShowCommentTree(false)}
                onCommentSelect={() => {
                  setShowCommentTree(false);
                  setShowComments(true);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
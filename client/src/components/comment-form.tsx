import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface CommentFormProps {
  postId: number;
  parentId?: number;
  onSuccess?: () => void;
}

export default function CommentForm({ postId, parentId, onSuccess }: CommentFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");

  const createCommentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/comments", {
        content: comment,
        postId,
        parentId
      });
      return res.json();
    },
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: [`/api/posts/${postId}/comments`] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      
      toast({
        title: "Comment posted",
        description: parentId ? "Your reply has been added" : "Your comment has been added"
      });
      
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to post comment. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to comment",
        variant: "destructive",
      });
      return;
    }
    
    if (!comment.trim()) {
      toast({
        title: "Empty comment",
        description: "Please enter a comment",
        variant: "destructive",
      });
      return;
    }
    
    createCommentMutation.mutate();
  };

  if (!user) {
    return (
      <div className="text-center py-2">
        <p className="text-muted-foreground mb-2">Log in to join the conversation</p>
        <Button variant="outline" size="sm" className="mr-2">Log In</Button>
        <Button size="sm">Sign Up</Button>
      </div>
    );
  }

  return (
    <form className="comment-form flex items-start gap-3" onSubmit={handleSubmit}>
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback className="bg-primary/20 text-primary">
          {user.username.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 comment-form-content">
        <div className="comment-form-container">
          <Textarea
            className="w-full bg-card/50 border border-border rounded-md p-3 text-sm min-h-[100px] focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20"
            placeholder={parentId ? "Escribe una respuesta..." : "Escribe un comentario..."}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          
          <div className="flex justify-end mt-2 comment-form-actions">
            <Button 
              type="submit" 
              className="bg-primary hover:bg-primary/90 text-white" 
              disabled={createCommentMutation.isPending}
            >
              {createCommentMutation.isPending ? 
                "Enviando..." : 
                parentId ? "Responder" : "Comentar"}
            </Button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          <span>Formato con Markdown está soportado</span>
        </div>
      </div>
    </form>
  );
}

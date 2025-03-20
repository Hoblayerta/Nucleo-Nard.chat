import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import "./comment-form.css"; // Importar los estilos CSS específicos

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
    <form className="comment-form-container" onSubmit={handleSubmit}>
      <Avatar className="comment-form-avatar">
        <AvatarFallback className="bg-primary/20 text-primary">
          {user.username.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1">
        <Textarea
          className="comment-form-textarea"
          placeholder={parentId ? "Write a reply..." : "Write a comment..."}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        <div className="flex justify-end mt-2">
          <Button 
            type="submit" 
            className="comment-form-button"
            disabled={createCommentMutation.isPending}
          >
            {createCommentMutation.isPending ? "Posting..." : parentId ? "Reply" : "Comment"}
          </Button>
        </div>
      </div>
    </form>
  );
}
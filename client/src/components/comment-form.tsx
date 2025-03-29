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
      <div className="comment-form-container">
        <div className="comment-form-header">
          <span className="comment-form-title">Participa en la conversación</span>
        </div>
        <div className="comment-form-body text-center py-3">
          <p className="text-muted-foreground mb-3">Debes iniciar sesión para poder comentar en este post</p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" size="sm">Iniciar sesión</Button>
            <Button size="sm">Registrarse</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`comment-form ${parentId ? 'is-reply' : ''}`}>
      <form onSubmit={handleSubmit}>
        <div className="comment-form-container">
          <div className="comment-form-header">
            <span className="comment-form-title">
              {parentId ? "Escribe una respuesta" : "Escribe un comentario"}
            </span>
          </div>
          
          <div className="comment-form-body">
            <textarea
              className="comment-form-textarea"
              placeholder={parentId ? "Tu respuesta..." : "Tu comentario..."}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            
            <div className="comment-form-actions">
              <button
                type="submit"
                className="comment-form-submit"
                disabled={createCommentMutation.isPending}
              >
                {createCommentMutation.isPending ? "Enviando..." : parentId ? "Responder" : "Comentar"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
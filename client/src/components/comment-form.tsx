import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Lock, Clock } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress"; 
import "./comment-form.css"; // Importar los estilos CSS específicos

interface CommentFormProps {
  postId: number;
  parentId?: number;
  onSuccess?: () => void;
  isFrozen?: boolean;
  slowModeInterval?: number;
}

export default function CommentForm({ 
  postId, 
  parentId, 
  onSuccess, 
  isFrozen = false, 
  slowModeInterval = 0 
}: CommentFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [slowModeCountdown, setSlowModeCountdown] = useState(0);
  const countdownInterval = useRef<number | null>(null);

  // Limpiar el intervalo cuando el componente se desmonte
  useEffect(() => {
    return () => {
      if (countdownInterval.current) {
        window.clearInterval(countdownInterval.current);
      }
    };
  }, []);

  // Progreso del cooldown (0-100%)
  const cooldownProgress = slowModeCountdown > 0 
    ? 100 - (slowModeCountdown / slowModeInterval) * 100 
    : 100;

  const startCountdown = (seconds: number) => {
    setSlowModeCountdown(seconds);
    
    if (countdownInterval.current) {
      window.clearInterval(countdownInterval.current);
    }
    
    countdownInterval.current = window.setInterval(() => {
      setSlowModeCountdown(prev => {
        if (prev <= 1) {
          if (countdownInterval.current) {
            window.clearInterval(countdownInterval.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const createCommentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/comments", {
        content: comment,
        postId,
        parentId
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        // Si es error de límite de tasa (429) por modo lento
        if (res.status === 429 && errorData.remainingSeconds) {
          startCountdown(errorData.remainingSeconds);
        }
        throw new Error(errorData.message || "Error al publicar comentario");
      }
      
      return res.json();
    },
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: [`/api/posts/${postId}/comments`] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });

      // Si el modo lento está activado, iniciar el contador
      if (slowModeInterval > 0) {
        startCountdown(slowModeInterval);
      }

      toast({
        title: "Comment posted",
        description: parentId ? "Your reply has been added" : "Your comment has been added"
      });

      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: Error) => {
      // Solo mostrar toast para errores que no sean de modo lento
      if (!error.message.includes("Modo lento activado")) {
        toast({
          title: "Error",
          description: error.message || "Failed to post comment. Please try again.",
          variant: "destructive",
        });
      }
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
    
    // No permitir comentar si el modo lento está activo y el contador aún no ha terminado
    if (slowModeCountdown > 0) {
      toast({
        title: "Modo lento activado",
        description: `Debes esperar ${slowModeCountdown} segundos antes de comentar nuevamente.`,
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

  // Si el post está congelado, mostrar mensaje de bloqueo
  if (isFrozen) {
    return (
      <div className="p-3 bg-muted/20 rounded-md">
        <p className="flex items-center text-muted-foreground text-sm">
          <Lock className="h-4 w-4 mr-2 text-destructive" />
          Este post está bloqueado. No se pueden añadir nuevos comentarios.
        </p>
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
        {/* Barra de progreso para el modo lento si está activo */}
        {slowModeInterval > 0 && (
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs flex items-center text-muted-foreground">
                <Clock className="h-3 w-3 mr-1" />
                {slowModeCountdown > 0 
                  ? `Puedes comentar en ${slowModeCountdown} segundos` 
                  : 'Puedes comentar ahora'}
              </span>
              <span className="text-xs text-muted-foreground">
                {slowModeInterval > 0 
                  ? `Modo lento: ${slowModeInterval} segundos`
                  : ''}
              </span>
            </div>
            <Progress value={cooldownProgress} className="h-1" />
          </div>
        )}
        
        <Textarea
          className="comment-form-textarea"
          placeholder={parentId ? "Write a reply..." : "Write a comment..."}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={slowModeCountdown > 0}
        />

        <div className="flex justify-end mt-2">
          <Button 
            type="submit" 
            className="comment-form-button"
            disabled={createCommentMutation.isPending || slowModeCountdown > 0}
          >
            {createCommentMutation.isPending 
              ? "Posting..." 
              : slowModeCountdown > 0
                ? `Espera ${slowModeCountdown}s`
                : parentId 
                  ? "Reply" 
                  : "Comment"
            }
          </Button>
        </div>
      </div>
    </form>
  );
}
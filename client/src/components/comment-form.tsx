import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useSlowMode } from "@/hooks/use-slow-mode";
import { Lock, Clock, AtSign } from "lucide-react";
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
}

export default function CommentForm({ 
  postId, 
  parentId, 
  onSuccess, 
  isFrozen = false
}: CommentFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [mentionedUsers, setMentionedUsers] = useState<string[]>([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Obtener la lista de usuarios para menciones
  const { data: users = [] } = useQuery<Array<{id: number, username: string}>>({
    queryKey: ['/api/users/list'],
    enabled: !!user
  });
  
  // Función para verificar si el usuario está escribiendo una mención (@)
  const checkForMention = (text: string, cursorPos: number) => {
    // Buscar la última ocurrencia de @ antes de la posición del cursor
    const textUntilCursor = text.substring(0, cursorPos);
    const lastAtSymbol = textUntilCursor.lastIndexOf('@');
    
    if (lastAtSymbol >= 0) {
      // Verificar que el @ no sea parte de una palabra (debe estar precedido por espacio o ser el inicio del texto)
      const isStartOfText = lastAtSymbol === 0;
      const isPrecededBySpace = lastAtSymbol > 0 && /\s/.test(text[lastAtSymbol - 1]);
      
      if (isStartOfText || isPrecededBySpace) {
        // Extraer la consulta (texto entre @ y la posición actual del cursor)
        const query = textUntilCursor.substring(lastAtSymbol + 1);
        
        // Si hay una consulta y no contiene espacios, mostrar sugerencias
        if (query.length > 0 && !query.includes(' ')) {
          setMentionQuery(query);
          setShowMentionSuggestions(true);
          return;
        }
      }
    }
    
    // Si no se cumplen las condiciones, ocultar las sugerencias
    setShowMentionSuggestions(false);
    setMentionQuery("");
  };
  
  // Usar el contexto de SlowMode para sincronizar la cuenta atrás entre todos los formularios
  const { 
    countdown: slowModeCountdown, 
    startCountdown, 
    cooldownProgress, 
    slowModeInterval,
    setSlowModeInterval 
  } = useSlowMode();

  // Ya no necesitamos actualizar el intervalo de modo lento basado en props
  // ya que ahora se maneja globalmente desde el contexto de SlowMode

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
      </div>
    );
  }

  // Si el post está congelado, mostrar mensaje de bloqueo
  if (isFrozen) {
    return (
      <div className="p-3 bg-muted/20 rounded-md border border-muted/30">
        <p className="flex items-center text-muted-foreground text-sm">
          <Lock className="h-4 w-4 mr-2 text-destructive" />
          Este post está bloqueado. No se pueden añadir nuevos comentarios.
        </p>
      </div>
    );
  }
  
  // Si el modo lento está activado y el contador aún no ha terminado, inhabilitar la entrada de texto
  const isSlowModeActive = slowModeInterval > 0 && slowModeCountdown > 0;

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
          <div className={`slow-mode-container ${slowModeCountdown > 0 ? 'slow-mode-active' : ''}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-yellow-600" />
                {slowModeCountdown > 0 ? (
                  <span>
                    Podrás comentar en <span className="slow-mode-countdown">{slowModeCountdown}</span> segundos
                  </span>
                ) : (
                  <span className="text-green-600 font-medium">Puedes comentar ahora</span>
                )}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                Intervalo: {slowModeInterval}s
              </span>
            </div>
            <Progress 
              value={cooldownProgress} 
              className={`slow-mode-progress ${slowModeCountdown > 0 ? 'slow-mode-progress-active' : ''}`} 
            />
          </div>
        )}
        
        <div className="relative">
          <Textarea
            ref={textareaRef}
            className="comment-form-textarea"
            placeholder={parentId ? "Write a reply..." : "Write a comment..."}
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              const cursorPos = e.target.selectionStart || 0;
              setCursorPosition(cursorPos);
              checkForMention(e.target.value, cursorPos);
            }}
            onKeyDown={(e) => {
              // Al presionar Escape, cerrar las sugerencias
              if (e.key === 'Escape' && showMentionSuggestions) {
                setShowMentionSuggestions(false);
                e.preventDefault();
              }
            }}
            disabled={slowModeCountdown > 0}
          />
          
          {/* Lista de sugerencias de menciones */}
          {showMentionSuggestions && (
            <div className="absolute z-10 bg-white rounded-md shadow-lg border mt-1 max-h-60 overflow-y-auto w-60">
              {users
                .filter((u: any) => u.username.toLowerCase().includes(mentionQuery.toLowerCase()))
                .slice(0, 5)
                .map((user: any) => (
                  <div
                    key={user.id}
                    className="p-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2"
                    onClick={() => {
                      // Insertar la mención en el texto
                      const textBeforeCursor = comment.substring(0, cursorPosition);
                      const lastAtPos = textBeforeCursor.lastIndexOf('@');
                      const textBeforeMention = comment.substring(0, lastAtPos);
                      const textAfterCursor = comment.substring(cursorPosition);
                      const newText = `${textBeforeMention}@${user.username} ${textAfterCursor}`;
                      
                      setComment(newText);
                      setShowMentionSuggestions(false);
                      
                      // Actualizar la lista de usuarios mencionados
                      if (!mentionedUsers.includes(user.username)) {
                        setMentionedUsers([...mentionedUsers, user.username]);
                      }
                      
                      // Poner el foco de nuevo en el textarea
                      if (textareaRef.current) {
                        const newCursorPos = lastAtPos + user.username.length + 2; // +2 por @ y espacio
                        setTimeout(() => {
                          textareaRef.current?.focus();
                          textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
                        }, 0);
                      }
                    }}
                  >
                    <AtSign className="h-4 w-4 text-blue-500" />
                    {user.username}
                  </div>
                ))}
              {users.filter((u: any) => u.username.toLowerCase().includes(mentionQuery.toLowerCase())).length === 0 && (
                <div className="p-2 text-gray-500 text-sm">No hay usuarios que coincidan</div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end mt-2">
          <Button 
            type="submit" 
            className={`comment-form-button ${slowModeCountdown > 0 ? 'bg-yellow-600 hover:bg-yellow-700' : ''}`}
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
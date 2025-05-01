import { useParams } from 'wouter';
import CommentTreeView from '@/components/comment-tree-view';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function TreeViewPage() {
  const { id } = useParams<{ id?: string }>();
  const postId = id; // para mantener compatibilidad con el código existente
  const { toast } = useToast();
  
  // Si no hay ID del post, mostrar error
  if (!postId) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-card shadow-lg rounded-lg p-6 text-center">
          <h1 className="text-2xl font-bold mb-4 text-destructive">Error</h1>
          <p className="mb-6">No se ha especificado un ID de post válido.</p>
          <Button 
            onClick={() => window.location.href = '/'}
            className="w-full bg-primary hover:bg-primary/90"
          >
            Volver al inicio
          </Button>
        </div>
      </div>
    );
  }
  
  const handleClose = () => {
    window.close(); // Intentar cerrar la ventana
    window.location.href = `/posts/${postId}`; // Si no se puede cerrar, redirigir
  };
  
  const handleCommentSelect = (commentId: number) => {
    // Notificar al usuario
    toast({
      title: "Comentario seleccionado",
      description: `ID del comentario: ${commentId}`,
      duration: 2000,
    });
    
    // Abrir el post con el comentario seleccionado en una nueva pestaña
    const url = `/posts/${postId}?comment=${commentId}`;
    window.open(url, '_blank');
  };
  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Barra superior con botones para cerrar y volver */}
      <div className="bg-card shadow-sm border-b sticky top-0 z-10">
        <div className="container mx-auto py-2 px-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => window.location.href = `/posts/${postId}`}
              className="flex items-center gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Volver al post
            </Button>
          </div>
          
          <div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Contenedor principal que ocupa todo el alto restante */}
      <div className="flex-grow relative">
        {/* Altura completa menos la barra superior */}
        <div className="absolute inset-0">
          <CommentTreeView 
            postId={parseInt(postId)} 
            onClose={() => {}} // No hace nada en la versión standalone
            isStandalone={true} // Indica que está en modo independiente
            onCommentSelect={handleCommentSelect}
          />
        </div>
      </div>
    </div>
  );
}

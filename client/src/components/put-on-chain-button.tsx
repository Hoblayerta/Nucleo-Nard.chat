import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { saveToBlockchain } from '@/lib/blockchain';
import { CommentWithUser, Post } from '@shared/schema';
import { Loader2 } from 'lucide-react';

interface PutOnChainButtonProps {
  post: Post;
  comments: CommentWithUser[];
}

export function PutOnChainButton({ post, comments }: PutOnChainButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Función para encontrar el comentario con más likes
  const findTopComment = (comments: CommentWithUser[]): CommentWithUser | null => {
    if (!comments || comments.length === 0) return null;
    
    // Ordenar comentarios por voteScore (upvotes - downvotes) en orden descendente
    return [...comments].sort((a, b) => b.voteScore - a.voteScore)[0];
  };

  const handlePutOnChain = async () => {
    setIsLoading(true);
    
    try {
      // Encontrar el comentario con más likes
      const topComment = findTopComment(comments);
      
      // Preparar el texto que se enviará al blockchain
      // Formato: contenido del post + contenido del comentario con más likes (si existe)
      let onChainText = post.content;
      
      if (topComment) {
        onChainText += "\n\n--------\n\nTop Comment by @" + topComment.user.username + ": " + topComment.content;
      }
      
      // Guardar en blockchain
      const txHash = await saveToBlockchain(onChainText);
      
      toast({
        title: "¡Éxito!",
        description: "Datos guardados en la blockchain. Hash de transacción: " + txHash.substring(0, 10) + "...",
        duration: 5000,
      });
      
    } catch (error) {
      console.error("Error al guardar en blockchain:", error);
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error desconocido al guardar en blockchain",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={handlePutOnChain} 
      disabled={isLoading}
      className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Procesando...
        </>
      ) : (
        "Put On-Chain"
      )}
    </Button>
  );
}

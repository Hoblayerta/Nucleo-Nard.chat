import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wallet } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { connectWallet, disconnectWallet, saveToBlockchain } from '@/lib/wallet';
import { CommentWithUser, Post } from '@shared/schema';

interface PutOnChainButtonProps {
  post: Post;
  comments: CommentWithUser[];
}

export function PutOnChainButton({ post, comments }: PutOnChainButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const { toast } = useToast();
  const { isAdmin, isModerator } = useAuth();

  // Verificar si el usuario tiene permisos
  const hasPermission = isAdmin || isModerator;

  // Si el usuario no tiene permisos, no mostrar nada
  if (!hasPermission) return null;

  const handlePutOnChain = async () => {
    setIsLoading(true);
    try {
      // Preparar el texto que se enviará al blockchain
      let onChainText = `Post Title: ${post.title}\n\nContent: ${post.content}`;

      // Agregar los comentarios más relevantes
      const topComments = comments
        .sort((a, b) => b.voteScore - a.voteScore)
        .slice(0, 3);

      if (topComments.length > 0) {
        onChainText += "\n\n--- Top Comments ---\n";
        topComments.forEach((comment, index) => {
          onChainText += `\n${index + 1}. By @${comment.user.username}: ${comment.content}`;
        });
      }

      // Guardar en blockchain
      const txHash = await saveToBlockchain(onChainText);

      // Crear enlace a Arbiscan
      const txExplorerUrl = `https://sepolia.arbiscan.io/tx/${txHash}`;

      toast({
        title: "¡Datos guardados con éxito!",
        description: (
          <div className="flex flex-col gap-1">
            <p>Transacción enviada a Arbitrum Sepolia</p>
            <p className="text-xs text-primary break-all">{txHash}</p>
            <a 
              href={txExplorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline text-blue-500 hover:text-blue-700"
            >
              Ver en Arbiscan
            </a>
          </div>
        ),
        duration: 10000,
      });
    } catch (error) {
      console.error("Error al guardar en blockchain:", error);
      toast({
        title: "Error al guardar en blockchain",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
        duration: 7000,
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
        <>Put On-Chain</>
      )}
    </Button>
  );
}
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { setValueInContract, isMetaMaskAvailable, requestAccounts } from '@/lib/ethereum';
import { CommentWithUser, Post } from '@shared/schema';

interface EthereumButtonProps {
  post: Post;
  comments: CommentWithUser[];
}

export function EthereumButton({ post, comments }: EthereumButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { isAdmin, isModerator } = useAuth();
  
  // Solo admins y moderadores pueden usar esta funcionalidad
  const hasPermission = isAdmin || isModerator;

  // Encuentra el comentario con más likes
  const findTopComment = (comments: CommentWithUser[]): CommentWithUser | null => {
    if (!comments || comments.length === 0) return null;
    return [...comments].sort((a, b) => b.voteScore - a.voteScore)[0];
  };

  const handlePutOnChain = async () => {
    if (!isMetaMaskAvailable()) {
      toast({
        title: "MetaMask no detectado",
        description: "Por favor, instala la extensión MetaMask para usar esta funcionalidad.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Preparar el texto para guardar en la blockchain
      const topComment = findTopComment(comments);
      
      let onChainText = `Post Title: ${post.title}\n\nContent: ${post.content}`;
      
      if (topComment) {
        onChainText += `\n\n--------\n\nTop Comment by @${topComment.user.username}: ${topComment.content}`;
      }

      // Enviar la transacción a la blockchain
      const receipt = await setValueInContract(onChainText);
      const txHash = receipt.transactionHash;
      
      // URL para ver la transacción en el explorador
      const txExplorerUrl = `https://sepolia.arbiscan.io/tx/${txHash}`;
      
      // Mostrar notificación de éxito
      toast({
        title: "¡Datos guardados con éxito!",
        description: (
          <div className="flex flex-col gap-1">
            <p>Transacción enviada a Arbitrum Sepolia</p>
            <p className="text-xs text-primary break-all">{txHash}</p>
            <button 
              onClick={() => window.open(txExplorerUrl, '_blank')}
              className="text-xs underline text-blue-500 hover:text-blue-700 text-left mt-1"
            >
              Ver en Arbiscan
            </button>
          </div>
        ),
        duration: 10000,
      });
      
      // Abrir el explorador en una nueva pestaña
      window.open(txExplorerUrl, '_blank');
      
    } catch (error: any) {
      console.error("Error al guardar en blockchain:", error);
      
      // Personalizar mensaje de error
      let errorTitle = "Error al guardar en blockchain";
      let errorMessage = error instanceof Error ? error.message : "Error desconocido al guardar en blockchain";
      
      // Personalizar mensajes específicos
      if (errorMessage.includes('user rejected') || errorMessage.includes('rechazada')) {
        errorTitle = "Transacción cancelada";
        errorMessage = "Has rechazado la transacción en MetaMask.";
      } else if (errorMessage.includes('insufficient funds')) {
        errorTitle = "Fondos insuficientes";
        errorMessage = "Necesitas ETH en Arbitrum Sepolia para completar esta operación.";
      }
      
      toast({
        title: errorTitle,
        description: (
          <div className="flex flex-col gap-1">
            <p>{errorMessage}</p>
            {errorMessage.includes('fondos') && (
              <button 
                onClick={() => window.open('https://faucet.quicknode.com/arbitrum/sepolia', '_blank')}
                className="text-xs underline text-blue-500 hover:text-blue-700 text-left mt-1"
              >
                Obtener ETH de prueba para Arbitrum Sepolia
              </button>
            )}
          </div>
        ),
        variant: "destructive",
        duration: 7000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Si el usuario no tiene permisos, no mostrar nada
  if (!hasPermission) return null;

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
        <>
          <Wallet className="mr-2 h-4 w-4" />
          Put On-Chain
        </>
      )}
    </Button>
  );
}

import React, { useState, useEffect, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { connectWallet, disconnectWallet, saveToBlockchain, checkConnection, isMetaMaskAvailable } from '@/lib/wallet';
import { CommentWithUser, Post } from '@shared/schema';
import { useAuth } from '@/lib/auth';
import { Loader2, Wallet } from 'lucide-react';

interface PutOnChainButtonProps {
  post: Post;
  comments: CommentWithUser[];
}

export function PutOnChainButton({ post, comments }: PutOnChainButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const { toast } = useToast();
  const { isAdmin, isModerator } = useAuth();

  // Verificamos si el usuario tiene permisos para usar esta función
  const hasPermission = isAdmin || isModerator;

  // Verificar si hay una wallet conectada al cargar el componente
  useEffect(() => {
    // Función para verificar la conexión de wallet
    const verifyWalletConnection = async () => {
      try {
        if (!isMetaMaskAvailable()) {
          return; // No hay MetaMask disponible
        }
        
        // Comprobar si ya está conectado a MetaMask
        const connectionResult = await checkConnection();
        
        if (connectionResult.connected && connectionResult.address) {
          setIsWalletConnected(true);
          setWalletAddress(connectionResult.address);
        }
      } catch (error) {
        console.error("Error al verificar conexión de wallet:", error);
        // No mostramos error al usuario porque este es un chequeo silencioso
      }
    };

    if (hasPermission) {
      verifyWalletConnection();
    }

    // Función para escuchar cambios en las cuentas de MetaMask
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length > 0) {
        setIsWalletConnected(true);
        setWalletAddress(accounts[0]);
      } else {
        setIsWalletConnected(false);
        setWalletAddress("");
      }
    };

    // Agregar event listener para cambios de cuenta
    if (isMetaMaskAvailable() && hasPermission) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
    }

    // Cleanup al desmontar el componente
    return () => {
      if (isMetaMaskAvailable()) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, [hasPermission]);

  // Función para encontrar el comentario con más likes
  const findTopComment = (comments: CommentWithUser[]): CommentWithUser | null => {
    if (!comments || comments.length === 0) return null;
    
    // Ordenar comentarios por voteScore (upvotes - downvotes) en orden descendente
    return [...comments].sort((a, b) => b.voteScore - a.voteScore)[0];
  };

  // Función para conectar wallet usando Web3Modal
  const handleConnectWallet = async () => {
    setIsConnecting(true);
    try {
      // Conectar usando Web3Modal que soporta múltiples wallets
      const { address, web3 } = await connectWallet();
      
      if (address) {
        setIsWalletConnected(true);
        setWalletAddress(address);
        
        // Mostrar notificación de éxito
        toast({
          title: "Wallet conectada en Arbitrum Sepolia",
          description: `Conectado con ${address.substring(0, 6)}...${address.substring(address.length - 4)}`,
          duration: 5000,
        });
      } else {
        throw new Error("No se pudo obtener la dirección de la wallet");
      }
    } catch (error) {
      console.error("Error al conectar wallet:", error);
      
      // Personalizar mensaje de error
      let errorMessage = "No se pudo conectar la wallet";
      if (error instanceof Error) {
        // Si el error contiene información sobre Arbitrum Sepolia, es un error de red
        if (error.message.includes("Arbitrum Sepolia")) {
          errorMessage = error.message;
        } else if (error.message.includes("user rejected") || error.message.includes("rechazada")) {
          errorMessage = "La conexión fue rechazada por el usuario";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Error de conexión",
        description: errorMessage,
        variant: "destructive",
        duration: 7000,
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handlePutOnChain = async () => {
    setIsLoading(true);
    
    try {
      // Encontrar el comentario con más likes
      const topComment = findTopComment(comments);
      
      // Preparar el texto que se enviará al blockchain
      // Formato: contenido del post + contenido del comentario con más likes (si existe)
      let onChainText = `Post Title: ${post.title}\n\nContent: ${post.content}`;
      
      if (topComment) {
        onChainText += "\n\n--------\n\nTop Comment by @" + topComment.user.username + ": " + topComment.content;
      }
      
      // Guardar en blockchain
      const txHash = await saveToBlockchain(onChainText);
      
      // Calculamos el enlace a Arbiscan
      const txExplorerUrl = `https://sepolia.arbiscan.io/tx/${txHash}`;
      
      // Abrir el explorador en una nueva pestaña
      window.open(txExplorerUrl, '_blank');
      
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
      
    } catch (error) {
      console.error("Error al guardar en blockchain:", error);
      
      // Personalizar mensaje de error
      let errorTitle = "Error al guardar en blockchain";
      let errorMessage = error instanceof Error ? error.message : "Error desconocido al guardar en blockchain";
      
      // Personalizar mensajes específicos
      if (errorMessage.includes('Arbitrum Sepolia')) {
        errorTitle = "Error de red";
      } else if (errorMessage.includes('rechazada')) {
        errorTitle = "Transacción cancelada";
      } else if (errorMessage.includes('insufficient funds') || errorMessage.includes('fondos insuficientes')) {
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

  // Si la wallet no está conectada, mostrar botón de conexión
  if (!isWalletConnected) {
    return (
      <Button
        onClick={handleConnectWallet}
        disabled={isConnecting}
        className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold"
      >
        {isConnecting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Conectando...
          </>
        ) : (
          <>
            <Wallet className="mr-2 h-4 w-4" />
            Conectar Wallet
          </>
        )}
      </Button>
    );
  }

  // Si la wallet está conectada, mostrar botón para guardar en blockchain
  return (
    <Button 
      onClick={handlePutOnChain} 
      disabled={isLoading}
      className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold"
      title={`Conectado con ${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`}
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

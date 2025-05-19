import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { setValueInContract, isMetaMaskAvailable, requestAccounts, checkConnection } from '@/lib/ethereum';
import { CommentWithUser, Post } from '@shared/schema';

interface EthereumButtonProps {
  post: Post;
  comments: CommentWithUser[];
}

export function EthereumButton({ post, comments }: EthereumButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const { toast } = useToast();
  const { isAdmin, isModerator } = useAuth();
  
  // Solo admins y moderadores pueden usar esta funcionalidad
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
          setIsConnected(true);
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
        setIsConnected(true);
        setWalletAddress(accounts[0]);
      } else {
        setIsConnected(false);
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
      const txExplorerUrl = `https://explorer.sepolia.mantle.xyz/tx/${txHash}`;
      
      // Mostrar notificación de éxito
      toast({
        title: "¡Datos guardados con éxito!",
        description: (
          <div className="flex flex-col gap-1">
            <p>Transacción enviada a Mantle Sepolia</p>
            <p className="text-xs text-primary break-all">{txHash}</p>
            <button 
              onClick={() => window.open(txExplorerUrl, '_blank')}
              className="text-xs underline text-blue-500 hover:text-blue-700 text-left mt-1"
            >
              Ver en Mantlescan
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
        errorMessage = "Necesitas ETH en Mantle Sepolia para completar esta operación.";
      }
      
      toast({
        title: errorTitle,
        description: (
          <div className="flex flex-col gap-1">
            <p>{errorMessage}</p>
            {errorMessage.includes('fondos') && (
              <button 
                onClick={() => window.open('https://faucet.quicknode.com/Mantle/sepolia', '_blank')}
                className="text-xs underline text-blue-500 hover:text-blue-700 text-left mt-1"
              >
                Obtener ETH de prueba para Mantle Sepolia
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

  // Función para conectar wallet
  const handleConnectWallet = async () => {
    setIsLoading(true);
    try {
      // Solicitar acceso a las cuentas
      const accounts = await requestAccounts();
      if (accounts.length > 0) {
        setIsConnected(true);
        setWalletAddress(accounts[0]);
        toast({
          title: "Wallet conectada",
          description: `Conectado con ${accounts[0].substring(0, 6)}...${accounts[0].substring(accounts[0].length - 4)}`,
          duration: 3000,
        });
      }
    } catch (error) {
      console.error("Error al conectar wallet:", error);
      let errorMessage = "No se pudo conectar la wallet";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast({
        title: "Error de conexión",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Si el usuario no tiene permisos, no mostrar nada
  if (!hasPermission) return null;

  // Si la wallet no está conectada, mostrar botón de conexión
  if (!isConnected) {
    return (
      <Button
        onClick={handleConnectWallet}
        disabled={isLoading}
        className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold"
      >
        {isLoading ? (
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

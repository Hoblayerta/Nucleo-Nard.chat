import React from 'react';
import { Button } from '@/components/ui/button';
import { Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';

interface BlockchainButtonProps {
  postId: number;
}

export function BlockchainButton({ postId }: BlockchainButtonProps) {
  const { toast } = useToast();
  const { isAdmin, isModerator } = useAuth();
  
  // Solo admins y moderadores pueden usar esta funcionalidad
  const hasPermission = isAdmin || isModerator;

  const handlePutOnChain = () => {
    toast({
      title: "Guardando en blockchain",
      description: "Conectando con MetaMask...",
      duration: 3000,
    });
    
    // Aquí iría la lógica para guardar en blockchain
    console.log("Llamando a función blockchain para post:", postId);
  };

  // Si el usuario no tiene permisos, no mostrar nada
  if (!hasPermission) return null;

  return (
    <Button 
      onClick={handlePutOnChain} 
      className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold"
    >
      <Wallet className="mr-2 h-4 w-4" />
      Guardar en Blockchain
    </Button>
  );
}
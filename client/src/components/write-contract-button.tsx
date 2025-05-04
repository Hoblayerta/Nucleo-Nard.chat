import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { writeToContractFrontend } from '@/lib/writesm';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function WriteContractButton() {
  const { isAdmin, isModerator } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Solo los administradores y moderadores pueden usar esta función
  if (!isAdmin && !isModerator) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa un valor para escribir en el contrato",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await writeToContractFrontend(value);
      toast({
        title: "¡Éxito!",
        description: `Transacción completada con hash: ${result.txHash.substring(0, 10)}...`,
      });
      setIsOpen(false);
      setValue('');
    } catch (error) {
      console.error("Error al escribir en el contrato:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Ha ocurrido un error al escribir en el contrato",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="bg-indigo-600 hover:bg-indigo-700 text-white border-0"
        >
          Escribir en Contrato
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Escribir en Contrato Inteligente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="contract-value" className="text-sm font-medium">
              Valor a guardar en el contrato
            </label>
            <Input
              id="contract-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Introduce tu texto aquí"
              disabled={isLoading}
            />
          </div>
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading}
          >
            {isLoading ? "Procesando..." : "Guardar en Blockchain"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
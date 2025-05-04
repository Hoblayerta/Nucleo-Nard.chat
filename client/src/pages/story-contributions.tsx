import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

// Constantes - Estos valores deben ser secretos
const ARBITRUM_SEPOLIA_RPC = 'https://sepolia-rollup.arbitrum.io/rpc';
const CONTRACT_ADDRESS = ''; // Dirección del contrato DecentralizedStory
const MXNB_ADDRESS = '0x82B9e52b26A2954E113F94Ff26647754d5a4247D';

// ABI simplificado del contrato para contribuciones
const CONTRACT_ABI = [
  "function addContribution(string) external",
  "function voteContribution(uint256, bool) external",
  "function contributions(uint256) view returns (address,string,uint256,uint256)",
  "function getContributionCount() view returns (uint256)",
  "function getCurrentStoryId() view returns (uint256)"
];

// ABI para el token MXNB (ERC20)
const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address, uint256) returns (bool)",
  "function approve(address, uint256) returns (bool)"
];

export default function StoryContributions() {
  const [contributions, setContributions] = useState<any[]>([]);
  const [newContribution, setNewContribution] = useState('');
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [mxnbBalance, setMxnbBalance] = useState('0');
  const [currentStoryId, setCurrentStoryId] = useState<number | null>(null);
  
  const { toast } = useToast();

  // Conectar wallet
  async function connectWallet() {
    try {
      setLoading(true);
      setErrorMessage('');
      
      if (typeof window.ethereum !== 'undefined') {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const signer = provider.getSigner();
        const address = await signer.getAddress();
        
        setAccount(address);
        setConnected(true);
        
        // Obtener balance de MXNB
        await fetchMXNBBalance(address, provider);
        
        toast({
          title: "Wallet conectada",
          description: `Conectado como: ${address.substring(0, 6)}...${address.substring(38)}`,
        });
      } else {
        throw new Error("Metamask no está instalado");
      }
    } catch (error) {
      console.error("Error al conectar wallet:", error);
      setErrorMessage("Error al conectar wallet. Por favor intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  // Obtener balance de MXNB
  async function fetchMXNBBalance(address: string, provider: ethers.providers.Provider) {
    try {
      const tokenContract = new ethers.Contract(MXNB_ADDRESS, TOKEN_ABI, provider);
      const balance = await tokenContract.balanceOf(address);
      setMxnbBalance(ethers.utils.formatUnits(balance, 18));
    } catch (error) {
      console.error("Error al obtener balance de MXNB:", error);
    }
  }

  // Cargar contribuciones desde el contrato
  async function loadContributions() {
    if (!CONTRACT_ADDRESS) return;
    
    try {
      const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_SEPOLIA_RPC);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      
      // Obtener ID de la historia actual
      const storyId = await contract.getCurrentStoryId();
      setCurrentStoryId(storyId.toNumber());
      
      // Obtener número de contribuciones
      const count = await contract.getContributionCount();
      
      // Cargar todas las contribuciones
      const contributionList = [];
      for (let i = 0; i < count.toNumber(); i++) {
        const contrib = await contract.contributions(i);
        contributionList.push({
          contributor: contrib[0],
          content: contrib[1],
          votes: contrib[2].toNumber(),
          ipAssetId: contrib[3].toNumber(),
          index: i
        });
      }
      
      setContributions(contributionList);
      
    } catch (error) {
      console.error("Error al cargar contribuciones:", error);
    }
  }

  // Agregar nueva contribución
  async function addContribution() {
    if (!newContribution) {
      toast({
        title: "Error",
        description: "Por favor, ingresa el contenido de tu contribución",
        variant: "destructive",
      });
      return;
    }
    
    if (!connected) {
      toast({
        title: "Error",
        description: "Por favor, conecta tu wallet primero",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      
      // Enviar transacción para agregar contribución
      const tx = await contract.addContribution(newContribution);
      await tx.wait();
      
      // Limpiar campo y recargar contribuciones
      setNewContribution('');
      await loadContributions();
      
      toast({
        title: "Contribución agregada",
        description: "Tu contribución ha sido agregada exitosamente.",
      });
    } catch (error) {
      console.error("Error al agregar contribución:", error);
      setErrorMessage("Error al agregar contribución. Por favor intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  // Votar por una contribución
  async function voteForContribution(index: number, isUpvote: boolean) {
    if (!connected) {
      toast({
        title: "Error",
        description: "Por favor, conecta tu wallet primero",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      
      // Enviar transacción para votar
      const tx = await contract.voteContribution(index, isUpvote);
      await tx.wait();
      
      // Recargar contribuciones
      await loadContributions();
      
      toast({
        title: "Voto registrado",
        description: `Has ${isUpvote ? 'apoyado' : 'votado en contra'} esta contribución.`,
      });
    } catch (error) {
      console.error("Error al votar:", error);
      setErrorMessage("Error al registrar tu voto. Por favor intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  // Cargar datos iniciales
  useEffect(() => {
    if (CONTRACT_ADDRESS) {
      loadContributions();
    }
  }, []);

  // Refrescar balance cuando cambia la cuenta
  useEffect(() => {
    if (connected && account) {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      fetchMXNBBalance(account, provider);
    }
  }, [connected, account]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-background p-4 md:p-8">
      <div className="container mx-auto max-w-4xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Contribuciones a la Historia</h1>
          
          {connected ? (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs py-1">
                {account.substring(0, 6)}...{account.substring(38)}
              </Badge>
              <Badge variant="secondary" className="text-xs py-1">
                {parseFloat(mxnbBalance).toFixed(2)} MXNB
              </Badge>
            </div>
          ) : (
            <Button onClick={connectWallet} disabled={loading}>
              {loading ? "Conectando..." : "Conectar Wallet"}
            </Button>
          )}
        </div>
        
        {errorMessage && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive rounded-md">
            <p className="text-destructive">{errorMessage}</p>
          </div>
        )}
        
        {connected && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Agregar Nueva Contribución</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Escribe tu contribución a la historia..."
                rows={4}
                value={newContribution}
                onChange={(e) => setNewContribution(e.target.value)}
              />
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button onClick={addContribution} disabled={loading}>
                {loading ? "Enviando..." : "Enviar Contribución"}
              </Button>
            </CardFooter>
          </Card>
        )}
        
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">
              {currentStoryId !== null ? 
                `Contribuciones a la Historia #${currentStoryId}` : 
                'Todas las Contribuciones'}
            </h2>
            <Button variant="outline" size="sm" onClick={loadContributions} disabled={loading}>
              Actualizar
            </Button>
          </div>
          
          {contributions.length > 0 ? (
            <div className="space-y-4">
              {contributions.map((contrib, i) => (
                <Card key={i} className="overflow-hidden">
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="font-medium">
                          Contribuidor: {contrib.contributor.substring(0, 6)}...{contrib.contributor.substring(38)}
                        </span>
                        {contrib.ipAssetId > 0 && (
                          <Badge variant="outline" className="ml-2">
                            IP Asset #{contrib.ipAssetId}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-green-500 hover:text-green-700 hover:bg-green-100"
                          onClick={() => voteForContribution(contrib.index, true)}
                          disabled={loading || !connected}
                        >
                          ↑
                        </Button>
                        <span className={`font-bold ${contrib.votes >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {contrib.votes}
                        </span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-500 hover:text-red-700 hover:bg-red-100"
                          onClick={() => voteForContribution(contrib.index, false)}
                          disabled={loading || !connected}
                        >
                          ↓
                        </Button>
                      </div>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-md">
                      <p className="whitespace-pre-wrap">{contrib.content}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">
                  No hay contribuciones aún. ¡Sé el primero en contribuir!
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
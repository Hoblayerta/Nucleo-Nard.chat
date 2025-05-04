import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Web3Modal } from '@web3modal/standalone';
import { Web3Storage } from 'web3.storage';
import StoryProtocolABI from '../StoryProtocolABI.json';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

// Constantes - Estos valores deben configurarse como secretos en Replit
const ARBITRUM_SEPOLIA_RPC = 'https://sepolia-rollup.arbitrum.io/rpc';
const STORY_REGISTRY_ADDRESS = '0x2D2D47A1A7c4e82C5678C5C3D5eC9855cD37ef01';
const MXNB_ADDRESS = '0x82B9e52b26A2954E113F94Ff26647754d5a4247D';
const CONTRACT_ADDRESS = ''; // Dirección del contrato desplegado DecentralizedStory
const WEB3_STORAGE_TOKEN = ''; // Token para Web3.Storage

// ABI simplificado del contrato DecentralizedStory
const CONTRACT_ABI = [
  "function registerAndSetStory(string,string) external",
  "function currentStory() view returns (string)",
  "function contributions(uint256) view returns (address,string,uint256,uint256)"
];

export default function DecentralizedStory() {
  const [storyText, setStoryText] = useState('');
  const [ipName, setIpName] = useState('');
  const [currentStory, setCurrentStory] = useState('');
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [contributions, setContributions] = useState<any[]>([]);
  
  const { toast } = useToast();
  
  const web3Modal = new Web3Modal({
    projectId: '', // Incluir Project ID de WalletConnect
    walletConnectVersion: 2
  });

  // Función para conectar wallet
  async function connectWallet() {
    try {
      setLoading(true);
      setErrorMessage('');
      
      if (typeof window.ethereum !== 'undefined') {
        // Usar Metamask si está disponible
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const signer = provider.getSigner();
        const address = await signer.getAddress();
        
        setAccount(address);
        setConnected(true);
        
        toast({
          title: "Wallet conectada",
          description: `Conectado como: ${address.substring(0, 6)}...${address.substring(38)}`,
        });
      } else {
        // Usar Web3Modal como fallback
        const instance = await web3Modal.openModal();
        const provider = new ethers.providers.Web3Provider(instance);
        const signer = provider.getSigner();
        const address = await signer.getAddress();
        
        setAccount(address);
        setConnected(true);
        
        toast({
          title: "Wallet conectada",
          description: `Conectado como: ${address.substring(0, 6)}...${address.substring(38)}`,
        });
      }
    } catch (error) {
      console.error("Error al conectar wallet:", error);
      setErrorMessage("Error al conectar wallet. Por favor intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  // Función para subir a IPFS usando Web3.Storage
  async function uploadToIPFS(content: string) {
    if (!WEB3_STORAGE_TOKEN) {
      toast({
        title: "Error de configuración",
        description: "Token de Web3.Storage no configurado",
        variant: "destructive",
      });
      return null;
    }
    
    try {
      const client = new Web3Storage({ token: WEB3_STORAGE_TOKEN });
      const blob = new Blob([content], { type: 'text/plain' });
      const file = new File([blob], 'story.txt');
      const cid = await client.put([file]);
      
      return cid;
    } catch (error) {
      console.error("Error al subir a IPFS:", error);
      return null;
    }
  }

  // Función para registrar la historia en Story Protocol y blockchain
  async function publishStory() {
    if (!storyText) {
      toast({
        title: "Error",
        description: "Por favor, ingresa el texto de la historia",
        variant: "destructive",
      });
      return;
    }
    
    if (!ipName) {
      toast({
        title: "Error",
        description: "Por favor, ingresa un nombre para la IP",
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
      
      // 1. Subir contenido a IPFS primero
      const cid = await uploadToIPFS(storyText);
      if (!cid) {
        throw new Error("Error al subir a IPFS");
      }
      
      // 2. Conectar con el proveedor y obtener el signer
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      // 3. Crear instancia del contrato
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer
      );
      
      // 4. Registrar historia con referencia IPFS
      const storyWithIPFS = `${storyText}\n\nIPFS: ipfs://${cid}`;
      
      // 5. Ejecutar transacción
      const tx = await contract.registerAndSetStory(storyWithIPFS, ipName);
      await tx.wait();
      
      // 6. Actualizar UI
      loadCurrentStory();
      
      toast({
        title: "Historia registrada",
        description: `Tu historia ha sido registrada exitosamente en Story Protocol y blockchain. IPFS: ${cid}`,
      });
    } catch (error) {
      console.error("Error al publicar historia:", error);
      setErrorMessage("Error al publicar historia. Por favor intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  // Cargar la historia actual desde el contrato
  async function loadCurrentStory() {
    try {
      const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_SEPOLIA_RPC);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      
      const story = await contract.currentStory();
      setCurrentStory(story);
      
    } catch (error) {
      console.error("Error al cargar la historia:", error);
    }
  }

  // Cargar contribuciones
  async function loadContributions() {
    try {
      const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_SEPOLIA_RPC);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      
      // Obtener el número de contribuciones (esto depende de tu contrato)
      // Este enfoque simplificado asume que el contrato tiene un contador o array
      const contribArray = [];
      let index = 0;
      
      try {
        while (true) {
          const contrib = await contract.contributions(index);
          contribArray.push({
            contributor: contrib[0],
            content: contrib[1],
            votes: contrib[2].toNumber(),
            ipAssetId: contrib[3].toNumber()
          });
          index++;
        }
      } catch (e) {
        // Llegamos al final de las contribuciones
      }
      
      setContributions(contribArray);
      
    } catch (error) {
      console.error("Error al cargar contribuciones:", error);
    }
  }

  // Cargar datos cuando el componente se monte
  useEffect(() => {
    if (CONTRACT_ADDRESS) {
      loadCurrentStory();
      loadContributions();
    }
  }, []);

  // Función para obtener el ID de IP Asset en Story Protocol
  async function getIPAssetId(storyHash: string) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_SEPOLIA_RPC);
      const storyContract = new ethers.Contract(
        STORY_REGISTRY_ADDRESS,
        StoryProtocolABI,
        provider
      );
      
      // Calcular hash del contenido
      const contentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(storyHash));
      
      // Obtener ID de IP Asset
      const ipAssetId = await storyContract.getIPAssetIdByHash(contentHash);
      return ipAssetId.toString();
      
    } catch (error) {
      console.error("Error al obtener IP Asset ID:", error);
      return "Error al obtener IP";
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-background p-4 md:p-8">
      <div className="container mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold mb-8 text-center">Historia Descentralizada con Story Protocol</h1>
        
        {!connected && (
          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4">
                <p className="text-center">Conecta tu wallet para interactuar con la historia descentralizada</p>
                <Button onClick={connectWallet} disabled={loading}>
                  {loading ? "Conectando..." : "Conectar Wallet"}
                </Button>
                {errorMessage && <p className="text-destructive">{errorMessage}</p>}
              </div>
            </CardContent>
          </Card>
        )}
        
        {connected && (
          <div className="grid gap-8 grid-cols-1 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Crear Nueva Historia</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nombre de la IP</label>
                    <Input 
                      placeholder="Nombre único para la propiedad intelectual" 
                      value={ipName}
                      onChange={(e) => setIpName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Contenido de la Historia</label>
                    <Textarea 
                      placeholder="Escribe tu historia aquí..." 
                      rows={10} 
                      value={storyText}
                      onChange={(e) => setStoryText(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={() => {
                  setStoryText('');
                  setIpName('');
                }}>
                  Limpiar
                </Button>
                <Button onClick={publishStory} disabled={loading}>
                  {loading ? "Publicando..." : "Publicar en Blockchain"}
                </Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Historia Actual</CardTitle>
              </CardHeader>
              <CardContent>
                {currentStory ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <div className="bg-muted/50 p-4 rounded-md whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                      {currentStory}
                    </div>
                    
                    <div className="mt-4">
                      <h3 className="text-lg font-semibold">Información de IP</h3>
                      <p className="text-sm">Esta historia está registrada en Story Protocol.</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2"
                        onClick={async () => {
                          const ipId = await getIPAssetId(currentStory);
                          toast({
                            title: "IP Asset ID",
                            description: `ID: ${ipId}`,
                          });
                        }}
                      >
                        Verificar IP
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center">No hay historias registradas todavía</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
        
        {connected && contributions.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Contribuciones Previas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {contributions.map((contrib, index) => (
                  <div key={index} className="border rounded-md p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-medium">
                          Contribuidor: {contrib.contributor.substring(0, 6)}...{contrib.contributor.substring(38)}
                        </span>
                        <span className="text-sm text-muted-foreground ml-4">
                          Votos: {contrib.votes}
                        </span>
                      </div>
                      <span className="text-xs bg-muted px-2 py-1 rounded-full">
                        IP: {contrib.ipAssetId}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{contrib.content}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
import { ethers } from 'ethers';

// ABI del contrato
const contractABI = [
        {
                "inputs": [
                        {
                                "internalType": "string",
                                "name": "x",
                                "type": "string"
                        }
                ],
                "name": "set",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
        },
        {
                "inputs": [],
                "stateMutability": "nonpayable",
                "type": "constructor"
        },
        {
                "inputs": [],
                "name": "get",
                "outputs": [
                        {
                                "internalType": "string",
                                "name": "",
                                "type": "string"
                        }
                ],
                "stateMutability": "view",
                "type": "function"
        },
        {
                "inputs": [],
                "name": "owner",
                "outputs": [
                        {
                                "internalType": "address",
                                "name": "",
                                "type": "address"
                        }
                ],
                "stateMutability": "view",
                "type": "function"
        }
];

// La dirección del contrato en Arbitrum Sepolia
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199";

// Chain ID para Arbitrum Sepolia
const ARBITRUM_SEPOLIA_CHAIN_ID = '0x66eee'

// Datos de la red Arbitrum Sepolia
const ARBITRUM_SEPOLIA_PARAMS = {
  chainId: ARBITRUM_SEPOLIA_CHAIN_ID,
  chainName: 'Arbitrum Sepolia',
  nativeCurrency: {
    name: 'ETH',
    symbol: 'ETH',
    decimals: 18
  },
  rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
  blockExplorerUrls: ['https://sepolia.arbiscan.io/']
};

// Función para asegurarse de que MetaMask está conectado a Arbitrum Sepolia
async function ensureArbitrumSepoliaNetwork() {
  if (typeof window.ethereum === 'undefined') {
    throw new Error('MetaMask no está instalado.');
  }

  try {
    // Obtener el chainId actual
    const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
    
    // Si no estamos en Arbitrum Sepolia, intentamos cambiar la red
    if (currentChainId !== ARBITRUM_SEPOLIA_CHAIN_ID) {
      try {
        // Intentar cambiar a Arbitrum Sepolia
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: ARBITRUM_SEPOLIA_CHAIN_ID }],
        });
      } catch (switchError: any) {
        // Si el error es porque la red no está añadida a MetaMask, la añadimos
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [ARBITRUM_SEPOLIA_PARAMS],
          });
        } else {
          throw switchError;
        }
      }
    }
  } catch (error) {
    console.error('Error al cambiar de red:', error);
    throw new Error(
      'No se pudo conectar a Arbitrum Sepolia. Por favor, conecta tu wallet a la red Arbitrum Sepolia manualmente.'
    );
  }
}

// Función para conectar al proveedor de Ethereum (MetaMask)
export async function connectToBlockchain() {
  // Verificar si el navegador tiene MetaMask instalado
  if (typeof window.ethereum !== 'undefined') {
    try {
      // Solicitar conexión a MetaMask
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Asegurarse de que estamos en Arbitrum Sepolia
      await ensureArbitrumSepoliaNetwork();
      
      // Crear proveedor y signer
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Crear instancia del contrato
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);
      
      return { provider, signer, contract };
    } catch (error) {
      console.error("Error al conectar con la blockchain:", error);
      throw error;
    }
  } else {
    throw new Error("MetaMask no está instalado. Por favor instala MetaMask para usar esta función.");
  }
}

// Función para enviar datos al contrato (función set)
export async function saveToBlockchain(data: string) {
  try {
    // Verificar que tenemos conexión y estamos en la red correcta
    const { contract, provider } = await connectToBlockchain();
    
    // Verificar que estamos en Arbitrum Sepolia otra vez (por seguridad)
    const network = await provider.getNetwork();
    const chainId = network.chainId.toString(16);
    if ('0x' + chainId !== ARBITRUM_SEPOLIA_CHAIN_ID) {
      throw new Error(`Red incorrecta. Por favor, conecta a Arbitrum Sepolia (chainId: ${ARBITRUM_SEPOLIA_CHAIN_ID})`); 
    }
    
    // Preparamos los datos (asegurándonos de que no sean demasiado grandes)
    if (data.length > 10000) {
      data = data.substring(0, 9990) + '... (truncado)';
    }
    
    // Llamar a la función set del contrato
    console.log('Enviando transacción a Arbitrum Sepolia...');
    const tx = await contract.set(data);
    
    console.log('Transacción enviada:', tx.hash);
    console.log('Esperando confirmación...');
    
    // Esperar a que la transacción se confirme
    const receipt = await tx.wait();
    console.log('Transacción confirmada en el bloque:', receipt.blockNumber);
    
    // Agregar enlace al explorador de bloques
    const txHash = tx.hash;
    console.log(`Ver en Arbiscan: https://sepolia.arbiscan.io/tx/${txHash}`);
    
    return txHash;
  } catch (error: any) {
    console.error("Error al guardar datos en la blockchain:", error);
    
    // Personalizar mensajes de error comunes
    if (error.code === 'ACTION_REJECTED') {
      throw new Error('Transacción rechazada por el usuario');
    } else if (error.message.includes('insufficient funds')) {
      throw new Error('Fondos insuficientes para completar la transacción. Necesitas ETH en Arbitrum Sepolia.');
    } else if (error.message.includes('gas')) {
      throw new Error('Error en el gas de la transacción. Intenta ajustar el gas manualmente en MetaMask.');
    }
    
    throw error;
  }
}

// Función para obtener datos del contrato (función get)
export async function getFromBlockchain() {
  try {
    const { contract } = await connectToBlockchain();
    
    // Llamar a la función get del contrato
    const data = await contract.get();
    
    return data;
  } catch (error) {
    console.error("Error al obtener datos de la blockchain:", error);
    throw error;
  }
}

// Para TypeScript, necesitamos declarar la existencia de ethereum en window
declare global {
  interface Window {
    ethereum: any;
  }
}

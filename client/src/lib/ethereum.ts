import { ethers } from 'ethers';

// Extender Window para que TypeScript reconozca ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

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
  }
];

// Dirección del contrato en Arbitrum Sepolia
const contractAddress = '0xe074123df0616FdB1fD0E5Eb3efefe43D59b218a';

/**
 * Verificar si MetaMask está disponible
 */
export function isMetaMaskAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
}

/**
 * Obtener la cadena ID formateada en hexadecimal
 */
export function getChainIdHex(chainId: number): string {
  return `0x${chainId.toString(16)}`;
}

/**
 * Configuración de la red Arbitrum Sepolia
 */
const ARBITRUM_SEPOLIA_CONFIG = {
  chainId: '0x66eee', // 421614 en hexadecimal
  chainName: 'Arbitrum Sepolia',
  nativeCurrency: {
    name: 'ETH',
    symbol: 'ETH',
    decimals: 18
  },
  rpcUrls: ['https://api.zan.top/arb-sepolia', 'https://sepolia-rollup.arbitrum.io/rpc'],
  blockExplorerUrls: ['https://sepolia.arbiscan.io/']
};

/**
 * Cambiar a la red Arbitrum Sepolia
 */
export async function switchToArbitrumSepolia(): Promise<boolean> {
  if (!isMetaMaskAvailable()) {
    throw new Error('MetaMask no está instalado');
  }

  try {
    // Primero intentamos cambiar a la red si ya está agregada
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ARBITRUM_SEPOLIA_CONFIG.chainId }]
    });
    return true;
  } catch (error: any) {
    // Si el error es que la red no está agregada (código 4902), la agregamos
    if (error.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [ARBITRUM_SEPOLIA_CONFIG]
        });
        return true;
      } catch (addError) {
        console.error('Error al agregar la red Arbitrum Sepolia:', addError);
        throw addError;
      }
    } else {
      console.error('Error al cambiar a la red Arbitrum Sepolia:', error);
      throw error;
    }
  }
}

/**
 * Solicitar acceso a la cuenta de MetaMask
 */
export async function requestAccounts(): Promise<string[]> {
  if (!isMetaMaskAvailable()) {
    throw new Error('MetaMask no está instalado. Por favor instala MetaMask para continuar.');
  }

  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    return accounts;
  } catch (error) {
    console.error('Error al solicitar acceso a las cuentas:', error);
    throw error;
  }
}

/**
 * Función para establecer un valor en el contrato inteligente
 * @param value - El valor string que se quiere almacenar en el contrato
 * @returns Promise con la transacción
 */
export async function setValueInContract(value: string): Promise<any> {
  // Verifica si existe window.ethereum
  if (!isMetaMaskAvailable()) {
    throw new Error('MetaMask no está instalado. Por favor instala MetaMask para continuar.');
  }

  try {
    // Solicita acceso a las cuentas del usuario
    const accounts = await requestAccounts();
    const userAddress = accounts[0];
    
    // Verifica que estamos en la red correcta (Arbitrum Sepolia)
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    // Chain ID de Arbitrum Sepolia es 0x66eee (421614 en decimal)
    if (chainId !== ARBITRUM_SEPOLIA_CONFIG.chainId) {
      // Intentar cambiar a Arbitrum Sepolia
      await switchToArbitrumSepolia();
    }
    
    // Crea un proveedor con window.ethereum
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    
    // Crea una instancia del contrato
    const contract = new ethers.Contract(contractAddress, contractABI, signer);
    
    // Llama al método 'set' del contrato
    const transaction = await contract.set(value);
    
    // Espera a que la transacción sea minada
    const receipt = await transaction.wait();
    
    console.log('Transacción completada:', receipt);
    return receipt;
  } catch (error) {
    console.error('Error al establecer el valor en el contrato:', error);
    throw error;
  }
}

/**
 * Función para obtener el valor actual del contrato (función adicional)
 * @returns Promise con el valor almacenado
 */
export async function getValueFromContract(): Promise<string> {
  if (!isMetaMaskAvailable()) {
    throw new Error('MetaMask no está instalado. Por favor instala MetaMask para continuar.');
  }

  try {
    // Crea un proveedor
    const provider = new ethers.BrowserProvider(window.ethereum);
    
    // Crea una instancia del contrato (solo lectura en este caso)
    const contract = new ethers.Contract(contractAddress, contractABI, provider);
    
    // Llama al método 'get' del contrato
    const value = await contract.get();
    
    console.log('Valor obtenido:', value);
    return value;
  } catch (error) {
    console.error('Error al obtener el valor del contrato:', error);
    throw error;
  }
}

import Web3 from 'web3';

// Configuración de la red Arbitrum Sepolia
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

// Dirección del contrato y ABI
export const CONTRACT_ADDRESS = '0xe074123df0616FdB1fD0E5Eb3efefe43D59b218a';
export const CONTRACT_ABI = [
  {
    inputs: [
      {
        internalType: 'string',
        name: 'x',
        type: 'string'
      }
    ],
    name: 'set',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [],
    name: 'get',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  }
];

// Variables globales
let web3: Web3 | null = null;
let provider: any = null;

// Extender Window para que TypeScript reconozca ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

// Verificar si MetaMask está disponible
export const isMetaMaskAvailable = () => {
  return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
};

// Conectar a MetaMask
export const connectWallet = async () => {
  try {
    // Verificar si MetaMask está disponible
    if (!isMetaMaskAvailable()) {
      throw new Error('MetaMask no está instalado. Por favor, instala la extensión de MetaMask para usar esta funcionalidad.');
    }

    // Usar la provider de MetaMask
    provider = window.ethereum;
    web3 = new Web3(provider);

    // Solicitar conexión a la wallet
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    const address = accounts[0];

    // Cambiar a Arbitrum Sepolia si es necesario
    await switchToArbitrumSepolia();

    return { address, web3 };
  } catch (error) {
    console.error('Error al conectar wallet:', error);
    throw error;
  }
};

// Verificar conexión automáticamente
export const checkConnection = async () => {
  try {
    if (!isMetaMaskAvailable()) {
      return { connected: false };
    }

    provider = window.ethereum;
    web3 = new Web3(provider);

    const accounts = await provider.request({ method: 'eth_accounts' });
    if (accounts && accounts.length > 0) {
      return { connected: true, address: accounts[0], web3 };
    }
    
    return { connected: false };
  } catch (error) {
    console.error('Error al verificar conexión:', error);
    return { connected: false };
  }
};

// Función para cambiar a la red Arbitrum Sepolia
export const switchToArbitrumSepolia = async () => {
  if (!web3 || !provider) return false;

  try {
    // Verificar si estamos en la red correcta
    const chainId = await web3.eth.getChainId();
    const targetChainId = parseInt('0x66eee', 16); // 421614
    
    if (Number(chainId) === targetChainId) {
      console.log('Ya estamos en Arbitrum Sepolia');
      return true;
    }

    // Intentar cambiar a Arbitrum Sepolia
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x66eee' }] // chainId de Arbitrum Sepolia
      });
      return true;
    } catch (switchError: any) {
      // Si el error es que la red no está añadida, la añadimos
      if (switchError.code === 4902) {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [ARBITRUM_SEPOLIA_CONFIG],
        });
        return true;
      }
      throw switchError;
    }
  } catch (error) {
    console.error('Error al cambiar a Arbitrum Sepolia:', error);
    throw error;
  }
};

// Desconectar la wallet (en MetaMask esto es manual)
export const disconnectWallet = async () => {
  // Reseteamos las variables globales
  provider = null;
  web3 = null;
  return true;
};

// Guardar datos en el blockchain usando el contrato
export const saveToBlockchain = async (data: string) => {
  if (!web3) {
    throw new Error('No hay conexión a la blockchain. Conecta tu wallet primero.');
  }

  // Verificar que estamos en Arbitrum Sepolia
  await switchToArbitrumSepolia();

  // Crear una instancia del contrato
  const contract = new web3.eth.Contract(CONTRACT_ABI as any, CONTRACT_ADDRESS);

  // Limitar el tamaño de los datos
  if (data.length > 10000) {
    data = data.substring(0, 9990) + '... (truncado)';
  }

  try {
    console.log('Enviando transacción a Arbitrum Sepolia...');
    const accounts = await web3.eth.getAccounts();
    
    // Llamar a la función set del contrato
    const tx = await contract.methods.set(data).send({ from: accounts[0] });
    
    console.log('Transacción confirmada:', tx.transactionHash);
    console.log(`Ver en Arbiscan: https://sepolia.arbiscan.io/tx/${tx.transactionHash}`);
    
    return tx.transactionHash;
  } catch (error: any) {
    console.error('Error al guardar en blockchain:', error);
    
    // Personalizar mensajes de error comunes
    if (error.code === 4001) {
      throw new Error('Transacción rechazada por el usuario');
    } else if (error.message.includes('insufficient funds')) {
      throw new Error('Fondos insuficientes para completar la transacción. Necesitas ETH en Arbitrum Sepolia.');
    }
    
    throw error;
  }
};

// Obtener datos del blockchain usando el contrato
export const getFromBlockchain = async () => {
  if (!web3) {
    throw new Error('No hay conexión a la blockchain. Conecta tu wallet primero.');
  }

  try {
    // Crear una instancia del contrato
    const contract = new web3.eth.Contract(CONTRACT_ABI as any, CONTRACT_ADDRESS);
    
    // Llamar a la función get del contrato
    const data = await contract.methods.get().call();
    
    return data;
  } catch (error) {
    console.error('Error al obtener datos de la blockchain:', error);
    throw error;
  }
};

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

// La dirección del contrato necesitará ser configurada según la red y el despliegue específico
const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000"; // Reemplazar con la dirección real del contrato

// Función para conectar al proveedor de Ethereum (MetaMask)
export async function connectToBlockchain() {
  // Verificar si el navegador tiene MetaMask instalado
  if (typeof window.ethereum !== 'undefined') {
    try {
      // Solicitar conexión a MetaMask
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
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
    const { contract } = await connectToBlockchain();
    
    // Llamar a la función set del contrato
    const tx = await contract.set(data);
    
    // Esperar a que la transacción se confirme
    await tx.wait();
    
    return tx.hash;
  } catch (error) {
    console.error("Error al guardar datos en la blockchain:", error);
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

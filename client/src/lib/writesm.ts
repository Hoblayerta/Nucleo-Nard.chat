import {
  createPublicClient,
  createWalletClient,
  http,
  custom,
  parseAbi,
  encodeFunctionData,
} from "viem";
import { arbitrumSepolia } from "viem/chains";
import { abi } from "./abi.ts";

// Dirección del contrato inteligente
const contractAddress = "0xe074123df0616FdB1fD0E5Eb3efefe43D59b218a";

/**
 * Función para escribir en el contrato inteligente usando viem
 * @param value - El valor string que quieres guardar en el contrato
 * @param privateKey - Clave privada para firmar la transacción (solo para backend)
 * @returns Promise con el hash de la transacción
 */
export async function writeToContractBackend(
  value: string,
  privateKey: `0x${string}`,
) {
  try {
    // Crea un cliente público para interactuar con la blockchain
    const publicClient = createPublicClient({
      chain: arbitrumSepolia,
      transport: http("https://sepolia-rollup.arbitrum.io/rpc"),
    });

    // Crea un cliente wallet con la clave privada
    const walletClient = createWalletClient({
      chain: arbitrumSepolia,
      transport: http("https://sepolia-rollup.arbitrum.io/rpc"),
      account: privateKey as `0x${string}`, // La clave privada o una instancia de cuenta
    });

    // Obtiene la dirección de la cuenta desde la clave privada
    const [address] = await walletClient.getAddresses();

    // Prepara los datos de la transacción
    const { request } = await publicClient.simulateContract({
      address: contractAddress,
      abi,
      functionName: "set",
      args: [value],
      account: address,
    });

    // Envía la transacción
    const txHash = await walletClient.writeContract(request);

    console.log("Transacción enviada:", txHash);

    // Espera a que la transacción sea confirmada
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    console.log("Transacción confirmada en el bloque:", receipt.blockNumber);
    return { txHash, receipt };
  } catch (error) {
    console.error("Error al escribir en el contrato:", error);
    throw error;
  }
}

/**
 * Función para leer el valor actual del contrato
 * @returns Promise con el valor almacenado
 */
export async function readFromContract() {
  try {
    // Crea un cliente público
    const publicClient = createPublicClient({
      chain: arbitrumSepolia,
      transport: http("https://sepolia-rollup.arbitrum.io/rpc"),
    });

    // Lee datos del contrato (no requiere firma)
    const value = await publicClient.readContract({
      address: contractAddress,
      abi,
      functionName: "get",
    });

    console.log("Valor obtenido del contrato:", value);
    return value;
  } catch (error) {
    console.error("Error al leer del contrato:", error);
    throw error;
  }
}

/**
 * Versión para frontend que utiliza el proveedor de MetaMask
 * @param value - El valor string que quieres guardar en el contrato
 * @returns Promise con el hash de la transacción
 */
export async function writeToContractFrontend(value: string) {
  try {
    // Verifica si existe window.ethereum
    if (!window?.ethereum) {
      throw new Error(
        "No se encontró un proveedor de Ethereum. Instala MetaMask.",
      );
    }

    // Crea un cliente usando el proveedor de ventana
    const walletClient = createWalletClient({
      chain: arbitrumSepolia,
      transport: custom(window.ethereum),
    });

    // Solicita acceso a las cuentas
    const [address] = await walletClient.requestAddresses();

    // Crea un cliente público
    const publicClient = createPublicClient({
      chain: arbitrumSepolia,
      transport: http("https://sepolia-rollup.arbitrum.io/rpc"),
    });

    // Prepara la transacción
    const { request } = await publicClient.simulateContract({
      address: contractAddress,
      abi,
      functionName: "set",
      args: [value],
      account: address,
    });

    // El usuario firmará la transacción con MetaMask
    const txHash = await walletClient.writeContract(request);

    console.log("Transacción enviada:", txHash);

    // Espera a que la transacción sea confirmada
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    console.log("Transacción confirmada en el bloque:", receipt.blockNumber);
    return { txHash, receipt };
  } catch (error) {
    console.error("Error al escribir en el contrato desde el frontend:", error);
    throw error;
  }
}

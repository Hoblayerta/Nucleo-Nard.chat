// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IMailbox} from "@hyperlane-xyz/core/contracts/interfaces/IMailbox.sol";

contract Receptor is Ownable {
    error BuzonNoAutorizado();
    error EmisorNoAutorizado();
    error ChainIdNoAutorizado();

    struct MetadatosEmisor {
        bytes32 direccion;
        uint32 chainID;
    }

    struct MetadatosMensaje {
        string mensaje;
        address quienLoEnvia;
        bool tieneNFT; // Nuevo campo para estado del NFT
    }

    address public mailbox;
    uint256 public contadorMensajes;
    mapping(uint256 => MetadatosMensaje) private mensajes;
    MetadatosEmisor public emisor;

    constructor(address initialOwner, address mailbox_) Ownable(initialOwner) {
        mailbox = mailbox_;
    }

    function _establecerEmisor(address _direccion, uint32 _chainID) external onlyOwner {
        emisor.direccion = bytes32(uint256(uint160(_direccion)));
        emisor.chainID = _chainID;
    }

    function handle(
        uint32 _origin,
        bytes32 _sender,
        bytes calldata _data
    ) external payable virtual {
        if (msg.sender != mailbox) revert BuzonNoAutorizado();
        if (_sender != emisor.direccion) revert EmisorNoAutorizado();
        if (_origin != emisor.chainID) revert ChainIdNoAutorizado();

        // Decodifica el nuevo payload con el estado del NFT
        (string memory _mensaje, address _quienLoEnvia, bool _tieneNFT) = 
            abi.decode(_data, (string, address, bool));

        mensajes[contadorMensajes] = MetadatosMensaje(
            _mensaje,
            _quienLoEnvia,
            _tieneNFT
        );

        contadorMensajes++;
    }

    // Funciones getter actualizadas
    function obtenerMensajePorIndex(uint256 index) public view returns (MetadatosMensaje memory) {
        require(index < contadorMensajes, "Indice invalido");
        return mensajes[index];
    }

    function obtenerEstadoNFT(uint256 index) public view returns (bool) {
        require(index < contadorMensajes, "Indice invalido");
        return mensajes[index].tieneNFT;
    }

    function obtenerMensaje(uint256 index) public view returns (string memory) {
        require(index < contadorMensajes, "Indice invalido");
        return mensajes[index].mensaje;
    }

    function obtenerQuienLoEnvia(uint256 index) public view returns (address) {
        require(index < contadorMensajes, "Indice invalido");
        return mensajes[index].quienLoEnvia;
    }

    function obtenerContadorMensajes() public view returns (uint256) {
        return contadorMensajes;
    }
}
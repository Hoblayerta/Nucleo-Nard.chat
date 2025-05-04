// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IMailbox} from "@hyperlane-xyz/core/contracts/interfaces/IMailbox.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract Emisor is Ownable {
    IMailbox public mailbox;
    IERC721 public nftContract;

    struct MetadatosReceptor {
        bytes32 direccion;
        uint32 chainID;
    }

    MetadatosReceptor public receptor;

    constructor(
        address mailbox_,
        address initialOwner,
        address nftAddress
    ) Ownable(initialOwner) {
        mailbox = IMailbox(mailbox_);
        nftContract = IERC721(nftAddress);
    }

    function _establecerReceptor(address _direccion, uint32 _chainID) external onlyOwner {
        receptor.direccion = bytes32(uint256(uint160(_direccion)));
        receptor.chainID = _chainID;
    }

    function obtenerCotizacionPorEnvio(string memory mensaje) external view returns (uint256) {
        bytes memory payload = abi.encode(mensaje, msg.sender, false);
        return mailbox.quoteDispatch(receptor.chainID, receptor.direccion, payload);
    }

    function enviarMensaje(string memory mensaje) external payable {
        bool tieneNFT = nftContract.balanceOf(msg.sender) > 0;
        bytes memory payload = abi.encode(mensaje, msg.sender, tieneNFT);

        uint256 pago = mailbox.quoteDispatch(
            receptor.chainID,
            receptor.direccion,
            payload
        );

        mailbox.dispatch{value: pago}(
            receptor.chainID,
            receptor.direccion,
            payload
        );
    }
}
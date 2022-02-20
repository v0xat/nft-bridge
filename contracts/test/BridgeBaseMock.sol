// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";

import "../Asset721.sol";

/// @title Swaps ERC721 items between EVM compatible networks.
contract BridgeBaseMock is OwnableUpgradeable, PausableUpgradeable, IERC721ReceiverUpgradeable {
    /// Contracts chain id.
    uint256 private chainId;

    /// Backend signer address.
    address private validator;

    /// NFT contract address.
    address private asset;

    /// An ECDSA signature.
    struct Sig {
        /// v parameter
        uint8 v;
        /// r parameter
        bytes32 r;
        /// s parameter
        bytes32 s;
    }

    event SwapInitialized(
        uint256 indexed itemId,
        uint256 indexed chainTo,
        uint256 indexed chainFrom,
        address swapper,
        address to,
        string uri
    );

    event SwapRedeemed(
        bytes32 indexed hash,
        uint256 indexed itemId,
        uint256 indexed chainFrom,
        address to
    );

    event ChainAdded(uint256 indexed chainId, address indexed by);

    event ChainRemoved(uint256 indexed chainId, address indexed by);

    mapping(uint256 => bool) public supportedChains;
    
    mapping(bytes32 => bool) public redeemed;

    function _initialize(address _validator, address _asset, uint256 _chainId) internal initializer {
        __Ownable_init();
        __Pausable_init();

        validator = _validator;
        asset = _asset;
        chainId = _chainId;
    }

    function addChain(uint256 id) external whenNotPaused onlyOwner {
        supportedChains[id] = true;
        emit ChainAdded(id, msg.sender);
    }

    function removeChain(uint256 id) external whenNotPaused onlyOwner {
        supportedChains[id] = false;
        emit ChainRemoved(id, msg.sender);
    }

    function swap(uint256 id, address to, uint256 chainTo)
        external
        whenNotPaused
    {
        require(supportedChains[chainTo], "Swap to an unsupported chain");
        require(Asset721(asset).ownerOf(id) == msg.sender, "Caller is not token owner");

        Asset721(asset).safeTransferFrom(msg.sender, address(this), id);

        emit SwapInitialized(id, chainTo, chainId, msg.sender, to, Asset721(asset).tokenURI(id));
    }

    function redeem(
        bytes32 hash,
        Sig memory sig,
        uint256 id,
        string calldata uri,
        address to,
        uint256 chainFrom
    )
        external
        whenNotPaused
    {
        require(msg.sender == validator, "Only validator can execute redeem");
        require(!redeemed[hash], "Can't redeem twice");

        address signer = ECDSAUpgradeable.recover(hash, sig.v, sig.r, sig.s);
        require(signer == validator, "ECDSA: invalid signature");

        if (!Asset721(asset).exists(id)) {
          Asset721(asset).safeMint(id, to, uri);
        } else if (Asset721(asset).accountOwnsToken(address(this), id)) {
          Asset721(asset).safeTransferFrom(address(this), to, id);
        } else {
          revert("Item ID already in this chain");
        }

        // Old version (without enumerable)
        // (Asset721(asset).exists(id))
        // ? Asset721(asset).safeTransferFrom(address(this), to, id)
        // : Asset721(asset).safeMint(id, to, uri);

        redeemed[hash] = true;

        emit SwapRedeemed(hash, id, chainFrom, to);
    }

    /// @notice Pausing some functions of contract.
    /// @dev Available only to admin.
    /// Prevents calls to functions with `whenNotPaused` modifier.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpausing functions of contract.
    /// @dev Available only to admin.
    function unpause() external onlyOwner {
        _unpause();
    }

    /// Always returns `IERC721Receiver.onERC721Received.selector`.
    function onERC721Received(address, address, uint256, bytes memory) public virtual override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
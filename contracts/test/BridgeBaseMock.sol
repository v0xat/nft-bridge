// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

import "../Asset721.sol";

/** @title Swaps ERC721 items between EVM compatible networks. */
contract BridgeBaseMock is EIP712, IERC721Receiver, Ownable, Pausable {
  /** Contracts chain id. */
  uint256 public immutable chainId;

  /** Backend signer address. */
  address public gateway;

  /** NFT contract address. */
  address public asset;

  enum SwapStatus {
    Unknown,
    Initialized,
    Redeemed
  }

  /* An ECDSA signature. */ 
  struct Sig {
    /* v parameter */
    uint8 v;
    /* r parameter */
    bytes32 r;
    /* s parameter */
    bytes32 s;
  }

  struct SwapRequest {
    uint256 itemId;
    uint256 chainFrom;
    uint256 chainTo;
    address itemContract;
    address swapper;
    address to;
    SwapStatus status;
  }

  event SwapInitialized(
    bytes32 indexed hash,
    uint256 indexed itemId,
    uint256 indexed chainTo,
    uint256 chainFrom,
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

  mapping(bytes32 => SwapRequest) public requests;
  
  mapping(bytes32 => bool) public redeemed;

  constructor(
    string memory name,
    string memory version,
    address _gateway,
    address _asset,
    uint256 _chainId
  ) EIP712(name, version) {
    gateway = _gateway;
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
    
    SwapRequest memory request = SwapRequest({
      itemId: id,
      chainFrom: chainId,
      chainTo: chainTo,
      itemContract: asset,
      swapper: msg.sender,
      to: to,
      status: SwapStatus.Initialized
    });

    bytes32 hash = _hashToSign(request);
    requests[hash] = request;

    Asset721(asset).safeTransferFrom(msg.sender, address(this), id);

    emit SwapInitialized(hash, id, chainTo, chainId, msg.sender, to, Asset721(asset).tokenURI(id));
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
    require(msg.sender == gateway, "Only gateway can execute redeem");
    require(!redeemed[hash], "Can't redeem twice");

    address signer = ECDSA.recover(hash, sig.v, sig.r, sig.s);
    require(signer == gateway, "ECDSA: invalid signature");

    if (Asset721(asset).exists(id)) {
      Asset721(asset).safeTransferFrom(address(this), to, id);
    } else {
      Asset721(asset).safeMintBridge(id, chainFrom, to, uri);
    }

    redeemed[hash] = true;

    emit SwapRedeemed(hash, id, chainFrom, to);
  }

  function _hashToSign(SwapRequest memory req)
    private
    view
    returns (bytes32)
  {
    return ECDSA.toTypedDataHash(_domainSeparatorV4(), _hash(req, block.timestamp));
  }
  
  function _hash(SwapRequest memory req, uint256 timestamp)
    internal
    pure
    returns (bytes32) {
    return keccak256(
      abi.encode(
        timestamp,
        req.chainFrom,
        req.chainTo,
        req.itemContract,
        req.swapper,
        req.to,
        req.status
      )
    );
  }

  /** @notice Pausing some functions of contract.
    @dev Available only to admin.
    Prevents calls to functions with `whenNotPaused` modifier.
  */
  function pause() external onlyOwner {
    _pause();
  }

  /** @notice Unpausing functions of contract.
    @dev Available only to admin.
  */
  function unpause() external onlyOwner {
    _unpause();
  }

  /** Always returns `IERC721Receiver.onERC721Received.selector`. */
  function onERC721Received(address, address, uint256, bytes memory) public virtual override returns (bytes4) {
    return this.onERC721Received.selector;
  }
}
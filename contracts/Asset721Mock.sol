// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/** @dev Asset721.sol with constructor accepting chainId, so we can emulate different chains in tests. */
contract Asset721Mock is ERC721URIStorage, AccessControl {
  /** Role identifier for bridging NFTs across layers. */
  bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

  /** Max emission for current chain. */
  uint256 private immutable rangeUnit;

  /** Offset to start assign tokenIds from. */
  uint256 private immutable rangeMin;

  /** Last token id. */
  uint256 private immutable rangeMax;

  /** A counter for tracking token ids. */
  uint256 private tokenIds;

  /** Contracts chain id. */
  uint256 public immutable chainId;

  /** Chain ownership of a particular NFT. */
  mapping(uint256 => uint256) private nftLoc; // itemId => chainId

  /** @notice Creates a new ERC-721 item collection.
   * @param name Name of the collection.
   * @param symbol Symbol of the collection.
   */
  constructor(string memory name, string memory symbol, uint256 _rangeUnit, uint256 _chainId) ERC721(name, symbol) {
    chainId = _chainId;
    rangeUnit = _rangeUnit;
    rangeMin = chainId * rangeUnit;
    rangeMax = rangeMin + rangeUnit;
    tokenIds = rangeMin - 1;

    _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    _setupRole(BRIDGE_ROLE, msg.sender);
  }

  /**
   * @dev Safely mints `itemId` and transfers it to `to`.
   *
   * Requirements:
   * - If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received},
   * which is called upon a safe transfer.
   *
   * Emits a {Transfer} event.
   */
  function safeMint(
    address to,
    string memory tokenURI
  )
    external
    onlyRole(DEFAULT_ADMIN_ROLE)
  {
    tokenIds++;
    require(tokenIds <= rangeMax, "Reached token limit");
    uint256 id = tokenIds;

    _safeMint(to, id);
    _setTokenURI(id, tokenURI);

    nftLoc[id] = chainId;
  }

  function safeMintBridge(
    uint256 id,
    uint256 chainFrom,
    address to,
    string memory uri
  )
    external
    onlyRole(BRIDGE_ROLE)
  {
    // require(nftLoc[id] == 0, "This id belongs to another chain");
    // require(id >= rangeMin && id < rangeMax, "Incorrect id");

    _safeMint(to, id);
    _setTokenURI(id, uri);

    nftLoc[id] = chainFrom;
  }

  function exists(uint256 tokenId) external view returns(bool) {
    return _exists(tokenId);
  }

  function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, AccessControl) returns (bool) {
    return super.supportsInterface(interfaceId);
  }
}
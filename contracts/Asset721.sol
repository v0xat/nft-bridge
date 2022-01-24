// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/** ERC721 item creation contract. */
contract Asset721 is ERC721URIStorage, AccessControl {
  /** Role identifier for minter. */
  bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

  /** Role identifier for burner. */
  bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

  /** Max emission for current chain. */
  uint256 private immutable rangeUnit;

  /** Offset to start assign tokenIds from. */
  uint256 private immutable rangeMin;

  /** Last token id. */
  uint256 private immutable rangeMax;

  /** A counter for tracking token ids. */
  uint256 private tokenIds;

  /** @notice Creates a new ERC-721 item collection.
   * @param name Name of the collection.
   * @param symbol Symbol of the collection.
   * @param _rangeUnit Total supply of the items.
   */
  constructor(string memory name, string memory symbol, uint256 _rangeUnit) ERC721(name, symbol) {
    rangeUnit = _rangeUnit;
    rangeMin = block.chainid * rangeUnit;
    rangeMax = rangeMin + rangeUnit;
    tokenIds = rangeMin - 1;

    _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    _setupRole(MINTER_ROLE, msg.sender);
    _setupRole(BURNER_ROLE, msg.sender);
  }

  /** @notice Mints item `id`, id autoincremented.
   * @param to The address to mint to.
   * @param uri URI of the item.
   */
  function safeMint(address to, string memory uri)
    external
    onlyRole(MINTER_ROLE)
  {
    tokenIds++;
    require(tokenIds <= rangeMax, "Reached token limit");
    uint256 id = tokenIds;

    _safeMint(to, id);
    _setTokenURI(id, uri);
  }

  /** @notice Mints item by `id`.
   * @param id The id of the item.
   * @param to The address to mint to.
   * @param uri URI of the item.
   */
  function safeMint(uint256 id, address to, string memory uri)
    external
    onlyRole(MINTER_ROLE)
  {
    _safeMint(to, id);
    _setTokenURI(id, uri);
  }

  /** @notice Burns item `id`.
   * @param id The id of the item.
   */
  function burn(uint256 id) external onlyRole(BURNER_ROLE) {
    _burn(id);
  }

  /** @notice Checks if `tokenId` exists.
   * @param tokenId The id of the item.
   */
  function exists(uint256 tokenId) external view returns(bool) {
    return _exists(tokenId);
  }

  /** Override required by solidity. */
  function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, AccessControl) returns (bool) {
    return super.supportsInterface(interfaceId);
  }
}
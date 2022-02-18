// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title ERC721 Mock item creation contract.
contract Asset721Mock is ERC721Enumerable, ERC721URIStorage, AccessControl {
  /// Role identifier for minter.
  bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

  /// Role identifier for burner.
  bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

  /// Max emission for current chain.
  uint256 private immutable rangeUnit;

  /// Offset to start assign tokenIds from.
  uint256 private immutable rangeMin;

  /// Last token id.
  uint256 private immutable rangeMax;

  /// A counter for tracking token ids.
  uint256 private tokenIds;

  /// @notice Creates a new ERC-721 item collection.
  /// @param name Name of the collection.
  /// @param symbol Symbol of the collection.
  constructor(string memory name, string memory symbol, uint256 _rangeUnit, uint256 chainId) ERC721(name, symbol) {
    rangeUnit = _rangeUnit;
    rangeMin = chainId * rangeUnit;
    rangeMax = rangeMin + rangeUnit;
    tokenIds = rangeMin - 1;

    _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    _setupRole(MINTER_ROLE, msg.sender);
    _setupRole(BURNER_ROLE, msg.sender);
  }

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

  function safeMint(uint256 id, address to, string memory uri)
    external
    onlyRole(MINTER_ROLE)
  {
    _safeMint(to, id);
    _setTokenURI(id, uri);
  }

  function burn(uint256 id) external onlyRole(BURNER_ROLE) {
    _burn(id);
  }

  /// @notice Checks if `tokenId` exists.
  /// @param tokenId Item ID.
  function exists(uint256 tokenId) external view returns(bool) {
    return _exists(tokenId);
  }

  /// @notice Checks if `account` owns a specific item.
  /// @param account The address of the user.
  /// @param tokenId Item ID.
  function accountOwnsToken(address account, uint256 tokenId) external view returns(bool) {
    require(_exists(tokenId), "Non-existent token id");

    uint256 accountBalance = balanceOf(account);
    for (uint i = 0; i < accountBalance; i++) {
      if (tokenOfOwnerByIndex(account, i) == tokenId) return true;
    }
    return false;
  }


  /// Below are the override required by solidity.

  function _beforeTokenTransfer(address from, address to, uint256 tokenId)
    internal
    override(ERC721, ERC721Enumerable)
  {
    super._beforeTokenTransfer(from, to, tokenId);
  }

  function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
    super._burn(tokenId);
  }

  function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
    return super.tokenURI(tokenId);
  }

  function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, ERC721Enumerable, AccessControl) returns (bool) {
    return super.supportsInterface(interfaceId);
  }
}
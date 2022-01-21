// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "./BridgeBaseMock.sol";

contract BridgeEthMock is BridgeBaseMock {
  constructor(
    string memory name,
    string memory version,
    address _validator,
    address _asset,
    uint256 _chainId
  ) BridgeBaseMock(name, version, _validator, _asset, _chainId) {}
}
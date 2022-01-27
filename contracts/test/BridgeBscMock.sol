// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "./BridgeBaseMock.sol";

contract BridgeBscMock is BridgeBaseMock {
  constructor(
    address _validator,
    address _asset,
    uint256 _chainId
  ) BridgeBaseMock(_validator, _asset, _chainId) {}
}
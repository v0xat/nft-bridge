// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "./BridgeBaseMock.sol";

/// @title This contract is just to simplify the deployment process.
contract BridgeBscMock is BridgeBaseMock {
  constructor(
    address _validator,
    address _asset,
    uint256 _chainId
  ) BridgeBaseMock(_validator, _asset, _chainId) {}
}
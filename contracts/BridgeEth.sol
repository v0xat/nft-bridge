// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "./BridgeBase.sol";

/** @notice This contract is just to simplify the deployment process. */
contract BridgeEth is BridgeBase {
  constructor(
    string memory name,
    string memory version,
    address _validator,
    address _asset
  ) BridgeBase(name, version, _validator, _asset) {}
}
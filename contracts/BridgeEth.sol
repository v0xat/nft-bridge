// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "./BridgeBase.sol";

contract BridgeBsc is BridgeBase {
  constructor(
    string memory name,
    string memory version,
    address _gateway,
    address _asset
  ) BridgeBase(name, version, _gateway, _asset) {}
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "./BridgeBase.sol";

/// @title This contract is just to simplify the deployment process.
contract BridgeEth is BridgeBase {
    function initializeBridge(address _validator, address _asset) external initializer {
        BridgeBase._initialize(_validator, _asset);
    }
}
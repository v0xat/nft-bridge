// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "./BridgeBaseMock.sol";

/// @title This contract is just to simplify the deployment process.
contract BridgeEthMockV2 is BridgeBaseMock {
    function initializeBridge(address _validator, address _asset, uint256 _chainId) external initializer {
        BridgeBaseMock._initialize(_validator, _asset, _chainId);
    }
}
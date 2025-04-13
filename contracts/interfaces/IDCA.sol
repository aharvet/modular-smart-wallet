// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

interface IDCA {
    /// @custom:storage-location erc7201:modular-smart-wallet.dca
    struct DCAStorage {
        address router;
        address[] path;
        uint256 dayFrequency;
        uint256 amountIn;
        uint256 start;
        uint256 end;
        uint256 lastPeriodExecuted;
    }

    event BuyTriggered(uint256 currentPeriod);

    error BuyNotAllowed();

    function triggerBuy() external;
}

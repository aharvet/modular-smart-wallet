// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {ICommon} from "./interfaces/ICommon.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";

abstract contract Common is ICommon {
    bytes32 internal constant MAIN_STORAGE_LOCATION =
        bytes32(uint256(keccak256("modular-smart-wallet.main")) - 1) & ~bytes32(uint256(0xff));

    modifier onlyEntryPoint() {
        require(msg.sender == _getMainStorage().entryPoint, OnlyEntryPoint());
        _;
    }

    function entryPoint() public view virtual returns (IEntryPoint) {
        return IEntryPoint(_getMainStorage().entryPoint);
    }

    function _getMainStorage() internal pure returns (MainStorage storage s) {
        bytes32 position = MAIN_STORAGE_LOCATION;
        assembly {
            s.slot := position
        }
    }
}

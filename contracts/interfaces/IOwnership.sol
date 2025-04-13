// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {ICommon} from "./ICommon.sol";

interface IOwnership {
    event OwnershipTransferred(ICommon.PublicKey indexed previousPublicKey, ICommon.PublicKey indexed newPublicKey);

    function transferOwnership(ICommon.PublicKey memory newPublicKey) external;
}

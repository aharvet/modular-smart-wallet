// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

interface IModule is IERC165 {
    function installModule(bytes calldata initData) external returns (bytes4[] memory);

    function uninstallModule() external returns (bytes4[] memory);
}

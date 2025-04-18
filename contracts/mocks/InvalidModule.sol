// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";

contract InvalidModule is ERC165 {
    function installModule(bytes calldata) external pure returns (bytes4[] memory) {
        return new bytes4[](0);
    }

    function uninstallModule() external pure returns (bytes4[] memory) {
        return new bytes4[](0);
    }
}

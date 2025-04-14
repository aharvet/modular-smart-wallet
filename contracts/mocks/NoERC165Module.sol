// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

contract NoERC165Module {
    function installModule(bytes calldata) external pure returns (bytes4[] memory) {
        return new bytes4[](0);
    }

    function uninstallModule() external pure returns (bytes4[] memory) {
        return new bytes4[](0);
    }
}

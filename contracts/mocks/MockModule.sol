// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import {IModule} from "../interfaces/IModule.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Common} from "../Common.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";

contract MockModule is IModule, Common, ERC165 {
    /// @custom:storage-location erc7201:modular-smart-wallet.mock
    struct MockStorage {
        uint256 value;
    }

    event ValueSet(uint256 newValue);

    bytes32 internal constant MOCK_STORAGE_LOCATION =
        bytes32(uint256(keccak256("modular-smart-wallet.mock")) - 1) & ~bytes32(uint256(0xff));

    function supportsInterface(bytes4 interfaceId) public view override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(IModule).interfaceId || super.supportsInterface(interfaceId);
    }

    function installModule(bytes calldata) external pure override returns (bytes4[] memory) {
        return _getMethods();
    }

    function uninstallModule() external override returns (bytes4[] memory) {
        _getMockStorage().value = 0;
        return _getMethods();
    }

    function setValue(uint256 newValue) external onlyEntryPoint {
        _getMockStorage().value = newValue;

        emit ValueSet(newValue);
    }

    function getValue() external view returns (uint256) {
        return _getMockStorage().value;
    }

    function _getMethods() private pure returns (bytes4[] memory) {
        bytes4[] memory methods = new bytes4[](2);
        methods[0] = MockModule.setValue.selector;
        methods[1] = MockModule.getValue.selector;

        return methods;
    }

    function _getMockStorage() private pure returns (MockStorage storage s) {
        bytes32 position = MOCK_STORAGE_LOCATION;
        assembly {
            s.slot := position
        }
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import {IModule} from "../interfaces/IModule.sol";
import {IModularSmartWallet} from "../interfaces/IModularSmartWallet.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Common} from "../Common.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {ICommon} from "../interfaces/ICommon.sol";
import {IOwnership} from "../interfaces/IOwnership.sol";

contract Ownership is IOwnership, IModule, ERC165, Common {
    function supportsInterface(bytes4 interfaceId) public view override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(IModule).interfaceId || super.supportsInterface(interfaceId);
    }

    function installModule(bytes calldata) external pure returns (bytes4[] memory) {
        return _getMethods();
    }

    function uninstallModule() external pure returns (bytes4[] memory) {
        return _getMethods();
    }

    function transferOwnership(ICommon.PublicKey memory newPublicKey) external onlyEntryPoint {
        MainStorage storage s = _getMainStorage();
        PublicKey memory previousPublicKey = s.publicKey;
        s.publicKey = newPublicKey;

        emit OwnershipTransferred(previousPublicKey, newPublicKey);
    }

    function _getMethods() private pure returns (bytes4[] memory) {
        bytes4[] memory methods = new bytes4[](1);
        methods[0] = Ownership.transferOwnership.selector;

        return methods;
    }
}

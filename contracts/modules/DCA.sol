// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import {IModule} from "../interfaces/IModule.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {Common} from "../Common.sol";
import {IUniswapV2Router01} from "../third-party/interfaces/IUniswapV2Router01.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IDCA} from "../interfaces/IDCA.sol";

contract DCA is IDCA, IModule, Common, ERC165 {
    bytes32 internal constant DCA_STORAGE_LOCATION =
        bytes32(uint256(keccak256("modular-smart-wallet.dca")) - 1) & ~bytes32(uint256(0xff));

    function supportsInterface(bytes4 interfaceId) public view override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(IModule).interfaceId || super.supportsInterface(interfaceId);
    }

    function installModule(bytes calldata initData) external returns (bytes4[] memory) {
        DCAStorage storage s = _getDCAStorage();
        (
            address router,
            address tokenIn,
            address tokenOut,
            uint256 dayFrequency,
            uint256 amountIn,
            uint256 start,
            uint256 end
        ) = abi.decode(initData, (address, address, address, uint256, uint256, uint256, uint256));

        s.router = router;
        s.path = new address[](2);
        s.path[0] = tokenIn;
        s.path[1] = tokenOut;
        s.dayFrequency = dayFrequency;
        s.amountIn = amountIn;
        s.start = start;
        s.end = end;

        IERC20(tokenIn).approve(router, type(uint256).max);

        return _getMethods();
    }

    function uninstallModule() external returns (bytes4[] memory) {
        DCAStorage storage s = _getDCAStorage();

        IERC20(s.path[0]).approve(s.router, 0);

        s.router = address(0);
        s.path = new address[](0);
        s.dayFrequency = 0;
        s.amountIn = 0;
        s.start = 0;
        s.end = 0;
        s.lastPeriodExecuted = 0;

        return _getMethods();
    }

    function getSettings() external pure returns (DCAStorage memory) {
        return _getDCAStorage();
    }

    /// @dev Meant to be called by a relayer but can be called by anyone because the
    /// amount and frequency is limited
    function triggerBuy() external {
        DCAStorage storage s = _getDCAStorage();

        require(block.timestamp >= s.start, BuyNotAllowed());
        require(block.timestamp <= s.end, BuyNotAllowed());

        // Calculate the current period based on how many full periods have elapsed since start
        uint256 periodDuration = s.dayFrequency * 1 days;
        uint256 currentPeriod = (block.timestamp - s.start) / periodDuration + 1;

        // Check if we are trying to execute a period that has already been executed
        require(currentPeriod > s.lastPeriodExecuted, BuyNotAllowed());

        // Update the last period executed
        s.lastPeriodExecuted = currentPeriod;

        IUniswapV2Router01(s.router).swapExactTokensForTokens(
            s.amountIn, s.amountIn * 92 / 100, s.path, address(this), block.timestamp
        );

        emit BuyTriggered(currentPeriod);
    }

    function _getMethods() private pure returns (bytes4[] memory) {
        bytes4[] memory methods = new bytes4[](2);
        methods[0] = DCA.getSettings.selector;
        methods[1] = DCA.triggerBuy.selector;

        return methods;
    }

    function _getDCAStorage() private pure returns (DCAStorage storage s) {
        bytes32 position = DCA_STORAGE_LOCATION;
        assembly {
            s.slot := position
        }
    }
}

# Modular Smart Wallet

This project is an ERC 4337 compliant smart wallet with passkey authentication.
It also allows for arbitrary modules to be installed to extend its capabilities.

- **ERC-4337 Account Abstraction** for gasless and batched transactions
- **WebAuthn Authentication** for secure keyless login using device biometrics
- **Modular Architecture** with pluggable modules for extensibility

## Project Structure

The project uses an opinionated infrastructure that revolves around a core smart wallet contract.

This contract implements all the ERC 4337 requirements.

It expects a WebAuthn signature for authentication.

It also implements logic to install and unintall modules.

Once installed, the core contract will delegate call to modules, based of the selector, if no matching function is found.

- `ModularSmartWallet.sol`: Core wallet implementation with passkey verification and module management
- `Common.sol`: Shared functionality between core contract and modules.
- `modules`: Pluggable functionality extensions (DCA, Ownership)
- `third-party`: Contracts imported from vendor for small adaptations
- `test/utils/signing.ts`: Logic to emulate the creation of a passkey signature

## Installation

```bash
npm i
```

Set a mainnet RPC URL for forking during test (to use ERC 4337 infrastructure)

```bash
npx hardhat vars set <MAINNET_RPC_URL>
```

To run the tests

```bash
npx hardhat test
```

To deploy the contracts, configure desired networks in `hardhat.config.ts` and use

```bash
npx hardhat ignition deploy ignition/modules/ModularSmartWallet.ts --network <NETWORK_NAME>
```

## Usage

The wallet fully complies with [ERC 4337](https://eips.ethereum.org/EIPS/eip-4337). All the basic execute calls can be done through the alt mempool infrastructure.

The user can also call two functions to add and remove modules :

- `function addModule(address module, bytes initData)`: Install a module. The `initData` value is arbitrary and varies depending on the module.
- `function removeModule(address module)`: Uninstall a module.

## Passkeys

The passkey authentication is handle with the [p256-verifier](https://github.com/daimo-eth/p256-verifier) infrastructure from daimo-eth.

The library imported in `third-party` calls a predeployed contract that works like a precompile.

It contains the logic to validate or invalidate a P256 signature, used by passkeys.

The `signing.ts` script contains the logic to emulate a passkey signature, including the data requirement to fit the WebAuthn standard.

## Modules

Modules are independent smart contract.

Their logic is going to be "imported" into the core contract via `.delegateCall` once they are installed.

### Create a module

The module contract MUST comply with the `IModule.sol` interface.

This implies implementing interface detection with [ERC 165](https://eips.ethereum.org/EIPS/eip-165) to confirm it complies with `IModule.sol`, as well as implementing two function.

- `function installModule(bytes initData) returns (bytes4[])`: Run initializing logic (write values in storage, make external calls, ...) and returns an array of bytes4 that contains the selectors of the methods it provides, including getters.
- `function uninstallModule() returns (bytes4[])`: Reset storage slots used and other values modified by the module (including in other contracts) and returns an array of bytes4 that contains the selectors of the methods it provides, including getters.

The module contract MUST use namespaced storage layout with [ERC 7201](https://eips.ethereum.org/EIPS/eip-7201) for any value written in storage.

The module contract can optionally inherit `Common.sol` to access main wallet storage and limit access to entry point.

### Provided modules

The repo contains two modules.

#### Ownership

Gives access to a `transferOwnership` function that allows to set a new public key to access the wallet.

- `function transferOwnership(ICommon.PublicKey memory newPublicKey) external`

#### DCA

Allows to set a periodic swap for two ERC 20 tokens that can be triggered by any address.

The idea is to automate it with a relayer.

The module will limit the calls to the desired tokens, amount, frequency and timeframe.

Those settings are set during installation.

Recommended relayer solutions : [Gelato](https://www.gelato.network/web3-functions), [Chainlink](https://chain.link/automation)

- `function getSettings() pure returns (DCAStorage)`: Returns the settings that the module uses to operate.
- `function triggerBuy()`: Trigger a swap on UniswapV2, according to settings.

During installation, the module requires an abi encoded bytes parameter such as :

```solidity
(
    address router, // UniswapV2 router
    address tokenIn, // ERC 20 token detained by wallet
    address tokenOut, // ERC 20 token to buy
    uint256 dayFrequency, // Frequency at which the buys must be done in days
    uint256 amountIn, // Amount to buy for each trigger
    uint256 start, // Start timestamp in seconds
    uint256 end // End timestamp in seconds
)
```

# Cega SDK for EVM (Ethereum)

[![npm (tag)](https://img.shields.io/npm/v/@cega-fi/cega-sdk-evm)](https://www.npmjs.com/package/@cega-fi/cega-sdk-evm)
[![npm bundle size (scoped version)](https://img.shields.io/bundlephobia/minzip/@cega-fi/cega-sdk-evm/latest.svg)](https://bundlephobia.com/result?p=@cega-fi/cega-sdk-evm@latest)

### Introduction to Cega Smart Contracts

Cega has 3 core contracts:

1. CegaState
2. Product contracts
3. Vault contracts

CegaState is the root contract that contains a list of all products that Cega offers. We currently have multiple types of Product contracts - FCNProduct & LOVProduct, and each product has multiple associated vaults, with different trading periods and with different leverage levels (for LOV).

Some methods are dependent on the product contract type, specified with the suffix (Fcn, Lov), while most other methods are independent of product contract type.

### Cega State Address

The active CegaState address is: `0x0730AA138062D8Cc54510aa939b533ba7c30f26B`

### Audit report links

- [Ottersec 2023 Cega Security Audit - Ethereum](https://drive.google.com/file/d/1a0nYzQ41kZMFDxDDDOJua3V2UTK8v2jX/view?pli=1 'Ottersec 2023 Cega Security Audit - Ethereum')
- [Zellic 2023 Cega Smart Contract Audit - Ethereum](https://drive.google.com/file/d/1qcNiP-5vQpqUqo4WzlNT6gsjzKSd8IqZ/view?pli=1 'Zellic 2023 Cega Smart Contract Audit - Ethereum')

### Introduction to Gas Stations

A gas station determines how we set fees for each transaction, specifically around `maxPriorityFeePerGas`, `maxFeePerGas`, `gasPrice`, etc. We have a few default GasStations available in the repository:

- GasStation (default)
- EthereumAlchemyGasStation
- EthereumEtherscanGasStation
- PolygonGasStation

You can also create your own custom gas station and use that when initializing the SDK.

### Getting started with CegaEvmSDK

```tsx
import { GasStation, CegaEvmSDK } from '@cega-fi/cega-sdk-evm';

const sdk = new CegaEvmSDK(
  '0x0730AA138062D8Cc54510aa939b533ba7c30f26B',
  new GasStation(), // or new EthereumEtherscanGasStation(apiKey), etc.
  provider,
  signer,
);
```

For an example of its usage, check `app.ts`.

### How to sanity test locally

1. `$ cp .env.sample .env`
2. Fill in .env file (only used for the test runner)
3. `$ yarn dev`

This will iterate through and get values from the contract address

### License

MIT License (including **all** dependencies).

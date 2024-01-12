### Introduction to Gas Stations

A gas station determines how we set fees for each transaction, specifically around `maxPriorityFeePerGas`, `maxFeePerGas`, `gasPrice`, etc. We have a few default GasStations available in the repository:

- GasStation (default)
- EthereumAlchemyGasStation
- EthereumEtherscanGasStation
- ArbitrumAlchemyGasStation
- ArbitrumInfuraGasStation

You can also create your own custom gas station and use that when initializing the SDK.

This is primarily useful if you need these values to be set for you automatically using some public pricing service.

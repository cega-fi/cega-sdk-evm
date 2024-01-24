import { BigNumberish, ethers } from 'ethers';
import { EvmAddress, OracleDataSourceDcs, TxOverrides } from './types';
import { GasStation } from './GasStation';

import Erc20Abi from './abi/ERC20.json';
import IDCSEntryAbi from './abiV2/IDCSEntry.json';
import AddressManagerAbi from './abiV2/AddressManager.json';
import TreasuryAbi from './abiV2/Treasury.json';
import IWrappingProxyAbi from './abiV2/IWrappingProxy.json';
import OracleEntryAbi from './abiV2/OracleEntry.json';
import PythAdapterAbi from './abiV2/PythAdapter.json';
import Chains, { IChainConfig, isValidChain } from './config/chains';

export default class CegaEvmSDKV2 {
  private _provider: ethers.providers.Provider;

  private _signer: ethers.Signer | undefined;

  private _gasStation: GasStation;

  private _addressManagerAddress: EvmAddress;

  private _treasuryAddress: EvmAddress;

  private _pythAdapterAddress: EvmAddress | undefined;

  constructor(
    addressManager: EvmAddress,
    treasuryAddress: EvmAddress,
    gasStation: GasStation,
    provider: ethers.providers.Provider,
    signer: ethers.Signer | undefined = undefined,
    pythAdapterAddress: EvmAddress | undefined = undefined,
  ) {
    this._provider = provider;
    this._signer = signer;
    this._gasStation = gasStation;
    this._addressManagerAddress = addressManager;
    this._treasuryAddress = treasuryAddress;
    this._pythAdapterAddress = pythAdapterAddress;
  }

  setProvider(provider: ethers.providers.Provider) {
    this._provider = provider;
  }

  setSigner(signer: ethers.Signer) {
    this._signer = signer;
  }

  setAddressManagerAddress(addressManagerAddress: EvmAddress) {
    this._addressManagerAddress = addressManagerAddress;
  }

  async getChainConfig(): Promise<IChainConfig> {
    const { chainId } = await this._provider.getNetwork();
    if (!isValidChain(chainId)) {
      throw new Error('Unsupported Chain ID');
    }
    const chainConfig = Chains[chainId];
    return chainConfig;
  }

  loadAddressManager(): ethers.Contract {
    return new ethers.Contract(
      this._addressManagerAddress,
      AddressManagerAbi.abi,
      this._signer || this._provider,
    );
  }

  async loadCegaEntry(): Promise<ethers.Contract> {
    const addressManager = this.loadAddressManager();
    const cegaEntryAddress = await addressManager.getCegaEntry();
    return new ethers.Contract(cegaEntryAddress, IDCSEntryAbi.abi, this._signer || this._provider);
  }

  async loadCegaWrappingProxy(): Promise<ethers.Contract> {
    const addressManager = this.loadAddressManager();
    const chainConfig = await this.getChainConfig();
    const cegaWrappingProxyAddress = await addressManager.getAssetWrappingProxy(
      chainConfig.tokens.stETH,
    );
    return new ethers.Contract(
      cegaWrappingProxyAddress,
      IWrappingProxyAbi.abi,
      this._signer || this._provider,
    );
  }

  async loadOracleEntry(): Promise<ethers.Contract> {
    const addressManager = this.loadAddressManager();
    const oracleEntryAddress = await addressManager.getCegaOracle();
    return new ethers.Contract(
      oracleEntryAddress,
      OracleEntryAbi.abi,
      this._signer || this._provider,
    );
  }

  async loadTreasury(): Promise<ethers.Contract> {
    return new ethers.Contract(
      this._treasuryAddress,
      TreasuryAbi.abi,
      this._signer || this._provider,
    );
  }

  async loadPythAdapter(): Promise<ethers.Contract> {
    if (!this._pythAdapterAddress) {
      throw new Error('PythAdapterAddress not defined');
    }
    return new ethers.Contract(
      this._pythAdapterAddress,
      PythAdapterAbi.abi,
      this._signer || this._provider,
    );
  }

  /**
   * GETTER METHODS
   */

  async dcsGetProduct(productId: ethers.BigNumberish) {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.dcsGetProduct(productId);
  }

  async getProductMetadata(productId: ethers.BigNumberish) {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.getProductMetadata(productId);
  }

  async getVault(vaultAddress: EvmAddress) {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.getVault(vaultAddress);
  }

  async dcsGetVault(vaultAddress: EvmAddress) {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.dcsGetVault(vaultAddress);
  }

  async dcsCalculateLateFee(vaultAddress: EvmAddress) {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.dcsCalculateLateFee(vaultAddress);
  }

  async getLatestProductId(): Promise<number> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.getLatestProductId();
  }

  async getStrategyOfProduct(productId: ethers.BigNumberish) {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.getStrategyOfProduct(productId);
  }

  async dcsIsWithdrawalPossible(vaultAddress: EvmAddress) {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.dcsIsWithdrawalPossible(vaultAddress);
  }

  async dcsGetDepositQueue(productId: ethers.BigNumberish) {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.dcsGetDepositQueue(productId);
  }

  async dcsGetWithdrawalQueue(vaultAddress: EvmAddress) {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.dcsGetWithdrawalQueue(vaultAddress);
  }

  /**
   * USER FACING METHODS
   */

  async getAssetAllowanceToCega(
    asset: EvmAddress,
    ownerAddress: EvmAddress | null = null,
  ): Promise<ethers.BigNumber> {
    if (!(ownerAddress || this._signer)) {
      throw new Error('No owner present');
    }
    const ownerAddr = ownerAddress || (await this._signer?.getAddress());

    const erc20Contract = new ethers.Contract(asset, Erc20Abi.abi, this._provider);

    const chainConfig = await this.getChainConfig();
    if (chainConfig.name === 'ethereum-mainnet' && asset === chainConfig.tokens.stETH) {
      const cegaWrappingProxy = await this.loadCegaWrappingProxy();
      return erc20Contract.allowance(ownerAddr, cegaWrappingProxy.address);
    }

    const cegaEntry = await this.loadCegaEntry();
    return erc20Contract.allowance(ownerAddr, cegaEntry.address);
  }

  async approveErc20(
    amount: ethers.BigNumber,
    asset: EvmAddress,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    if (asset === ethers.constants.AddressZero) {
      throw new Error('Invalid asset address');
    }

    const chainConfig = await this.getChainConfig();
    if (chainConfig.name === 'ethereum-mainnet' && asset === chainConfig.tokens.stETH) {
      return this.approveErc20ForCegaProxy(amount, asset, overrides);
    }
    return this.approveErc20ForCegaEntry(amount, asset, overrides);
  }

  async increaseAllowanceErc20(
    amount: ethers.BigNumber,
    asset: EvmAddress,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    if (asset === ethers.constants.AddressZero) {
      throw new Error('Invalid asset address');
    }

    const chainConfig = await this.getChainConfig();
    if (chainConfig.name === 'ethereum-mainnet' && asset === chainConfig.tokens.stETH) {
      return this.increaseAllowanceErc20ForCegaProxy(amount, asset, overrides);
    }
    // TODO: Once we have some deposits with USDT, we can move from increaseAllowance
    // to just approve. Then we can rename this function and update the FE too
    if (
      [chainConfig.tokens.USDT.toLowerCase(), chainConfig.tokens.wBTC.toLowerCase()].includes(
        asset.toLowerCase(),
      )
    ) {
      return this.approveErc20ForCegaEntry(amount, asset, overrides);
    }
    return this.increaseAllowanceErc20ForCegaEntry(amount, asset, overrides);
  }

  private async approveErc20ForCegaEntry(
    amount: ethers.BigNumber,
    asset: EvmAddress,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    const erc20Contract = new ethers.Contract(asset, Erc20Abi.abi, this._signer);
    return erc20Contract.approve(cegaEntry.address, amount, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  private async approveErc20ForCegaProxy(
    amount: ethers.BigNumber,
    asset: EvmAddress,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaWrappingProxy = await this.loadCegaWrappingProxy();
    const erc20Contract = new ethers.Contract(asset, Erc20Abi.abi, this._signer);
    return erc20Contract.approve(cegaWrappingProxy.address, amount, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  private async increaseAllowanceErc20ForCegaEntry(
    amount: ethers.BigNumber,
    asset: EvmAddress,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    const erc20Contract = new ethers.Contract(asset, Erc20Abi.abi, this._signer);
    return erc20Contract.increaseAllowance(cegaEntry.address, amount, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  private async increaseAllowanceErc20ForCegaProxy(
    amount: ethers.BigNumber,
    asset: EvmAddress,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaWrappingProxy = await this.loadCegaWrappingProxy();
    const erc20Contract = new ethers.Contract(asset, Erc20Abi.abi, this._signer);
    return erc20Contract.increaseAllowance(cegaWrappingProxy.address, amount, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async dcsAddToDepositQueue(
    productId: ethers.BigNumberish,
    amount: ethers.BigNumber,
    asset: EvmAddress = ethers.constants.AddressZero,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    if (!this._signer) {
      throw new Error('Signer not defined');
    }

    const chainConfig = await this.getChainConfig();
    if (chainConfig.name === 'ethereum-mainnet' && asset === chainConfig.tokens.stETH) {
      return this.dcsAddToDepositQueueProxy(productId, amount, overrides);
    }

    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.dcsAddToDepositQueue(productId, amount, await this._signer.getAddress(), {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
      value: asset === ethers.constants.AddressZero ? amount : 0,
    });
  }

  private async dcsAddToDepositQueueProxy(
    productId: ethers.BigNumberish,
    amount: ethers.BigNumber,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    if (!this._signer) {
      throw new Error('Signer not defined');
    }
    const proxyEntry = await this.loadCegaWrappingProxy();
    return proxyEntry.wrapAndAddToDCSDepositQueue(
      productId,
      amount,
      await this._signer.getAddress(),
      {
        ...(await this._gasStation.getGasOraclePrices()),
        ...overrides,
      },
    );
  }

  async dcsAddToWithdrawalQueue(
    vaultAddress: EvmAddress,
    sharesAmount: ethers.BigNumber,
    withWrappingProxy: boolean,
    nextProductId: ethers.BigNumberish = 0,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    if (withWrappingProxy) {
      return this.dcsAddToWithdrawalQueueProxy(vaultAddress, sharesAmount, overrides);
    }

    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.dcsAddToWithdrawalQueue(vaultAddress, sharesAmount, nextProductId, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  private async dcsAddToWithdrawalQueueProxy(
    vaultAddress: EvmAddress,
    sharesAmount: ethers.BigNumber,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    if (!this._signer) {
      throw new Error('Signer not defined');
    }

    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.dcsAddToWithdrawalQueueWithProxy(
      vaultAddress,
      sharesAmount,
      await this._signer.getAddress(),
      {
        ...(await this._gasStation.getGasOraclePrices()),
        ...overrides,
      },
    );
  }

  /**
   * Withdraws "stuck" funds from the Treasury
   * This method must be called after withdraw queues are processed
   * for native ETH underlying vaults, for non EOA wallet (eg. multisigs)
   *
   * @param asset - The address of asset to be withdrawn
   * @returns Transaction response
   */
  async withdrawStuckAssets(
    asset: EvmAddress,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    if (!this._signer) {
      throw new Error('Signer not defined');
    }
    const treasury = await this.loadTreasury();
    return treasury.withdrawStuckAssets(asset, await this._signer.getAddress(), {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async getStuckAssets(asset: EvmAddress, receiver: EvmAddress): Promise<ethers.BigNumber> {
    const treasury = await this.loadTreasury();
    return treasury.stuckAssets(asset, receiver);
  }

  /**
   * CEGA TRADING METHODS
   */

  async dcsSetIsDepositQueueOpen(
    productId: ethers.BigNumberish,
    isDepositQueueOpen: boolean,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();

    return cegaEntry.dcsSetIsDepositQueueOpen(isDepositQueueOpen, productId, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async dcsBulkOpenVaultDeposits(
    vaultAddresses: EvmAddress[],
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.dcsBulkOpenVaultDeposits(vaultAddresses, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async dcsBulkProcessDepositQueues(
    vaultAddresses: EvmAddress[],
    maxProcessCount: ethers.BigNumberish,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.dcsBulkProcessDepositQueues(vaultAddresses, maxProcessCount, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async dcsEndAuction(
    vaultAddress: EvmAddress,
    auctionWinner: EvmAddress,
    tradeStartDate: Date,
    aprBps: number,
    oracleDataSource: OracleDataSourceDcs,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    const tradeStartInSeconds = Math.floor(tradeStartDate.getTime() / 1000);

    return cegaEntry.dcsEndAuction(
      vaultAddress,
      auctionWinner,
      tradeStartInSeconds,
      aprBps,
      oracleDataSource,
      {
        ...overrides,
      },
    );
  }

  /**
   * MARKET MAKER METHODS
   */

  async dcsBulkStartTrades(
    vaultAddresses: EvmAddress[],
    nativeAssetTransferSummedAmount?: ethers.BigNumber,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.dcsBulkStartTrades(vaultAddresses, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
      value: nativeAssetTransferSummedAmount ?? 0,
    });
  }

  async dcsBulkSettleVaults(
    vaultAddresses: EvmAddress[],
    nativeAssetTransferSummedAmount?: ethers.BigNumber,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.dcsBulkSettleVaults(vaultAddresses, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
      value: nativeAssetTransferSummedAmount ?? 0,
    });
  }

  /**
   * CEGA SETTLEMENT METHODS
   */

  async dcsBulkCollectFees(
    vaultAddresses: EvmAddress[],
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.dcsBulkCollectFees(vaultAddresses, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async dcsBulkProcessWithdrawalQueues(
    vaultAddresses: EvmAddress[],
    maxProcessCount: ethers.BigNumberish,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.dcsBulkProcessWithdrawalQueues(vaultAddresses, maxProcessCount, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async dcsBulkRolloverVaults(
    vaultAddresses: EvmAddress[],
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.dcsBulkRolloverVaults(vaultAddresses, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  /**
   * DISPUTE METHODS
   */

  async dcsSubmitDispute(
    vaultAddress: EvmAddress,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.dcsSubmitDispute(vaultAddress, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async dcsProcessTradeDispute(
    vaultAddress: EvmAddress,
    newPrice: ethers.BigNumber,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.dcsProcessTradeDispute(vaultAddress, newPrice, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async dcsGetOraclePriceOverride(
    vaultAddress: EvmAddress,
    overrideDateTime: Date,
  ): Promise<ethers.BigNumber> {
    const cegaEntry = await this.loadCegaEntry();
    const overrideDateInSeconds = Math.floor(overrideDateTime.getTime() / 1000);
    return cegaEntry.getOraclePriceOverride(vaultAddress, overrideDateInSeconds);
  }

  /**
   * OTHER PERMISSIONED METHODS
   */

  async dcsCreateVault(
    productId: ethers.BigNumberish,
    tokenName: string,
    tokenSymbol: string,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.dcsCreateVault(productId, tokenName, tokenSymbol, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async dcsSetManagementFee(
    vaultAddress: EvmAddress,
    managementFeeBps: number,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();

    return cegaEntry.dcsSetManagementFee(vaultAddress, managementFeeBps, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async dcsSetYieldFee(
    vaultAddress: EvmAddress,
    yieldFeeBps: number,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();

    return cegaEntry.dcsSetYieldFee(vaultAddress, yieldFeeBps, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async dcsSetMaxUnderlyingAmount(
    productId: ethers.BigNumberish,
    maxUnderlyingAmount: ethers.BigNumberish,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();

    return cegaEntry.dcsSetMaxUnderlyingAmount(maxUnderlyingAmount, productId, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  /**
   * CRANK METHODS
   */

  async dcsBulkCheckAuctionDefault(
    vaultAddresses: EvmAddress[],
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.dcsBulkCheckAuctionDefault(vaultAddresses, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async dcsBulkCheckSettlementDefault(
    vaultAddresses: EvmAddress[],
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.dcsBulkCheckSettlementDefault(vaultAddresses, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async dcsBulkCheckTradesExpiry(
    vaultAddresses: EvmAddress[],
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.dcsBulkCheckTradesExpiry(vaultAddresses, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  /**
   * ORACLE METHODS
   */

  async getOraclePrice(
    baseAsset: EvmAddress,
    quoteAsset: EvmAddress,
    timestamp: number,
    oracleDataSource: OracleDataSourceDcs = OracleDataSourceDcs.Pyth,
  ): Promise<ethers.BigNumber> {
    const oracleEntry = await this.loadOracleEntry();
    return oracleEntry.getPrice(baseAsset, quoteAsset, timestamp, oracleDataSource);
  }

  async pythUpdateAssetPrices(
    timestamp: Date,
    assetAddresses: EvmAddress[],
    updates: string[],
    fee: BigNumberish,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const pythAdapter = await this.loadPythAdapter();
    return pythAdapter.updateAssetPrices(
      Math.floor(timestamp.getTime() / 1000),
      assetAddresses,
      updates,
      { value: fee, ...(await this._gasStation.getGasOraclePrices()), ...overrides },
    );
  }
}

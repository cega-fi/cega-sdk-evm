import { ethers } from 'ethers';
import { EvmAddress, OracleDataSourceDcs, TxOverrides } from './types';
import { GasStation } from './GasStation';

import Erc20Abi from './abi/ERC20.json';
import IDCSEntryAbi from './abiV2/IDCSEntry.json';
import AddressManagerAbi from './abiV2/AddressManager.json';
import IWrappingProxyAbi from './abiV2/IWrappingProxy.json';
import OracleEntryAbi from './abiV2/OracleEntry.json';
import Chains, { IChainConfig, isValidChain } from './config/chains';

export default class CegaEvmSDKV2 {
  private _provider: ethers.providers.Provider;

  private _signer: ethers.Signer | undefined;

  private _gasStation: GasStation;

  private _addressManagerAddress: EvmAddress;

  constructor(
    addressManager: EvmAddress,
    gasStation: GasStation,
    provider: ethers.providers.Provider,
    signer: ethers.Signer | undefined = undefined,
  ) {
    this._provider = provider;
    this._signer = signer;
    this._gasStation = gasStation;
    this._addressManagerAddress = addressManager;
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

  async dcsGetProduct(productId: ethers.BigNumberish) {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.getDCSProduct(productId);
  }

  async dcsSetIsDepositQueueOpen(
    productId: ethers.BigNumberish,
    isOpen: boolean,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.setDCSIsDepositQueueOpen(isOpen, productId, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  /**
   * USER FACING METHODS
   */

  async increaseAllowanceErc20(
    amount: ethers.BigNumber,
    asset: EvmAddress,
    overrides: TxOverrides = {},
  ) {
    if (asset === ethers.constants.AddressZero) {
      throw new Error('Invalid asset address');
    }

    const chainConfig = await this.getChainConfig();
    if (chainConfig.name === 'ethereum-mainnet' && asset === chainConfig.tokens.stETH) {
      return this.increaseAllowanceErc20ForCegaProxy(amount, asset, overrides);
    }
    return this.increaseAllowanceErc20ForCegaEntry(amount, asset, overrides);
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
    return cegaEntry.addToDCSDepositQueue(productId, amount, await this._signer.getAddress(), {
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
    return cegaEntry.addToDCSWithdrawalQueue(vaultAddress, sharesAmount, nextProductId, {
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
    return cegaEntry.addToDCSWithdrawalQueueWithProxy(
      vaultAddress,
      sharesAmount,
      await this._signer.getAddress(),
      {
        ...(await this._gasStation.getGasOraclePrices()),
        ...overrides,
      },
    );
  }

  // TODO: add this method when new contracts are deployed
  // async dcsWithdrawStuckAssets() {
  //   return null;
  // }

  /**
   * CEGA TRADING METHODS
   */

  async dcsBulkOpenVaultDeposits(
    vaultAddresses: EvmAddress[],
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.bulkOpenDCSVaultsDeposits(vaultAddresses, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async dcsBulkProcessDepositQueues(
    vaultAddresses: EvmAddress[],
    maxProcessCount: ethers.BigNumber,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.bulkProcessDCSDepositQueues(vaultAddresses, maxProcessCount, {
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

    return cegaEntry.endDCSAuction(
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
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.bulkStartDCSTrades(vaultAddresses, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async dcsBulkSettleVaults(
    vaultAddresses: EvmAddress[],
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.bulkSettleDCSVaults(vaultAddresses, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
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
    return cegaEntry.bulkCollectDCSFees(vaultAddresses, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async dcsBulkProcessWithdrawalQueues(
    vaultAddresses: EvmAddress[],
    maxProcessCount: ethers.BigNumber,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.bulkProcessDCSWithdrawalQueues(vaultAddresses, maxProcessCount, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async dcsBulkRolloverVaults(
    vaultAddresses: EvmAddress[],
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.bulkRolloverDCSVaults(vaultAddresses, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  /**
   * DISPUTE METHODS
   */

  async submitDispute(
    vaultAddress: EvmAddress,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.submitDispute(vaultAddress, {
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
    return cegaEntry.processTradeDispute(vaultAddress, newPrice, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async dcsGetOraclePriceOverride(
    vaultAddress: EvmAddress,
    overrideDateTime: Date,
  ): Promise<ethers.BigNumber> {
    const oracleEntry = await this.loadOracleEntry();
    const overrideDateInSeconds = Math.floor(overrideDateTime.getTime() / 1000);
    return oracleEntry.getOraclePriceOverride(vaultAddress, overrideDateInSeconds);
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
    return cegaEntry.createDCSVault(productId, tokenName, tokenSymbol, {
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
    return cegaEntry.bulkCheckDCSAuctionDefault(vaultAddresses, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async dcsBulkCheckSettlementDefault(
    vaultAddresses: EvmAddress[],
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.bulkCheckDCSSettlementDefault(vaultAddresses, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async dcsBulkCheckTradeExpiry(
    vaultAddresses: EvmAddress[],
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.bulkCheckDCSTradesExpiry(vaultAddresses, {
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
    oracleDataSource: OracleDataSourceDcs,
    overrides: TxOverrides = {},
  ): Promise<ethers.BigNumber> {
    const oracleEntry = await this.loadOracleEntry();
    return oracleEntry.getPrice(baseAsset, quoteAsset, timestamp, oracleDataSource);
  }
}

import { ethers } from 'ethers';
import { EvmAddress, OracleDataSourceDcs, TxOverrides } from './types';
import { GasStation } from './GasStation';

import Erc20Abi from './abi/ERC20.json';
import IDCSEntryAbi from './abiV2/IDCSEntry.json';
import IWrappingProxyAbi from './abiV2/IWrappingProxy.json';

export default class CegaEvmSDKV2 {
  private _provider: ethers.providers.Provider;

  private _signer: ethers.Signer | undefined;

  private _gasStation: GasStation;

  private _cegaEntryAddress: EvmAddress;

  private _cegaWrappingProxyAddress: EvmAddress;

  constructor(
    cegaEntryAddress: EvmAddress,
    cegaWrappingProxyAddress: EvmAddress,
    gasStation: GasStation,
    provider: ethers.providers.Provider,
    signer: ethers.Signer | undefined = undefined,
  ) {
    this._provider = provider;
    this._signer = signer;
    this._gasStation = gasStation;
    this._cegaEntryAddress = cegaEntryAddress;
    this._cegaWrappingProxyAddress = cegaWrappingProxyAddress;
  }

  setProvider(provider: ethers.providers.Provider) {
    this._provider = provider;
  }

  setSigner(signer: ethers.Signer) {
    this._signer = signer;
  }

  setCegaEntryAddress(cegaEntryAddress: EvmAddress) {
    this._cegaEntryAddress = cegaEntryAddress;
  }

  loadCegaEntry(): ethers.Contract {
    return new ethers.Contract(
      this._cegaEntryAddress,
      IDCSEntryAbi.abi,
      this._signer || this._provider,
    );
  }

  setCegaWrappingProxyAddress(cegaWrappingProxyAddress: EvmAddress) {
    this._cegaWrappingProxyAddress = cegaWrappingProxyAddress;
  }

  loadCegaWrappingProxy(): ethers.Contract {
    return new ethers.Contract(
      this._cegaWrappingProxyAddress,
      IWrappingProxyAbi.abi,
      this._signer || this._provider,
    );
  }

  async getProductDcs(productId: ethers.BigNumberish) {
    const cegaEntry = this.loadCegaEntry();
    return cegaEntry.getDCSProduct(productId);
  }

  async setIsDepositQueueOpenDcs(
    productId: ethers.BigNumberish,
    isOpen: boolean,
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = this.loadCegaEntry();
    return cegaEntry.setDCSIsDepositQueueOpen(isOpen, productId);
  }

  /**
   * USER FACING METHODS
   */

  async approveErc20(
    amount: ethers.BigNumber,
    asset: EvmAddress,
    withWrappingProxy: boolean,
    overrides: TxOverrides = {},
  ) {
    if (withWrappingProxy) {
      return this.approveErc20ForCegaProxy(amount, asset, overrides);
    }
    return this.approveErc20ForCegaEntry(amount, asset, overrides);
  }

  async approveErc20ForCegaEntry(
    amount: ethers.BigNumber,
    asset: EvmAddress,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    if (asset === ethers.constants.AddressZero) {
      throw new Error('Invalid asset address');
    }

    const erc20Contract = new ethers.Contract(asset, Erc20Abi.abi, this._signer);
    return erc20Contract.approve(this._cegaEntryAddress, amount, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async approveErc20ForCegaProxy(
    amount: ethers.BigNumber,
    asset: EvmAddress,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    if (asset === ethers.constants.AddressZero) {
      throw new Error('Invalid asset address');
    }

    const erc20Contract = new ethers.Contract(asset, Erc20Abi.abi, this._signer);
    return erc20Contract.approve(this._cegaWrappingProxyAddress, amount, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async addToDepositQueueDcs(
    productId: ethers.BigNumberish,
    amount: ethers.BigNumber,
    withWrappingProxy: boolean,
    asset: EvmAddress = ethers.constants.AddressZero,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    if (!this._signer) {
      throw new Error('Signer not defined');
    }

    if (withWrappingProxy) {
      return this.addToDepositQueueDcsProxy(productId, amount, overrides);
    }

    const cegaEntry = this.loadCegaEntry();
    return cegaEntry.addToDCSDepositQueue(productId, amount, await this._signer.getAddress(), {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
      value: asset === ethers.constants.AddressZero ? amount : 0,
    });
  }

  async addToDepositQueueDcsProxy(
    productId: ethers.BigNumberish,
    amount: ethers.BigNumber,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    if (!this._signer) {
      throw new Error('Signer not defined');
    }
    const proxyEntry = this.loadCegaWrappingProxy();
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

  async addToWithdrawalQueueDcs(
    vaultAddress: EvmAddress,
    sharesAmount: ethers.BigNumber,
    withWrappingProxy: boolean,
    nextProductId: ethers.BigNumberish = 0,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    if (!this._signer) {
      throw new Error('Signer not defined');
    }

    if (withWrappingProxy) {
      return this.addToWithdrawalQueueDcsProxy(vaultAddress, sharesAmount, overrides);
    }

    const cegaEntry = this.loadCegaEntry();
    return cegaEntry.addToDCSWithdrawalQueue(
      vaultAddress,
      sharesAmount,
      nextProductId,
      await this._signer.getAddress(),
      {
        ...(await this._gasStation.getGasOraclePrices()),
        ...overrides,
      },
    );
  }

  async addToWithdrawalQueueDcsProxy(
    vaultAddress: EvmAddress,
    sharesAmount: ethers.BigNumber,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    if (!this._signer) {
      throw new Error('Signer not defined');
    }

    const cegaEntry = this.loadCegaEntry();
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

  /**
   * CEGA TRADING METHODS
   */

  async bulkOpenVaultDepositsDcs(
    vaultAddresses: EvmAddress[],
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = this.loadCegaEntry();
    return cegaEntry.bulkOpenDCSVaultsDeposits(vaultAddresses, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async bulkProcessDepositQueuesDcs(
    vaultAddresses: EvmAddress[],
    maxProcessCount: ethers.BigNumber,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = this.loadCegaEntry();
    return cegaEntry.bulkProcessDCSDepositQueues(vaultAddresses, maxProcessCount, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async endAuctionDcs(
    vaultAddress: EvmAddress,
    auctionWinner: EvmAddress,
    tradeStartDate: Date,
    aprBps: number,
    oracleDataSource: OracleDataSourceDcs,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = this.loadCegaEntry();
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

  async bulkStartTradesDcs(
    vaultAddresses: EvmAddress[],
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = this.loadCegaEntry();
    return cegaEntry.bulkStartDCSTrades(vaultAddresses);
  }

  async bulkSettleVaultsDcs(
    vaultAddresses: EvmAddress[],
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = this.loadCegaEntry();
    return cegaEntry.bulkSettleDCSVaults(vaultAddresses);
  }

  /**
   * CEGA SETTLEMENT METHODS
   */

  async bulkCollectFeesDcs(
    vaultAddresses: EvmAddress[],
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = this.loadCegaEntry();
    return cegaEntry.bulkCollectDCSFees(vaultAddresses, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async bulkProcessWithdrawalQueuesDcs(
    vaultAddresses: EvmAddress[],
    maxProcessCount: ethers.BigNumber,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = this.loadCegaEntry();
    return cegaEntry.bulkProcessDCSWithdrawalQueues(vaultAddresses, maxProcessCount, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async bulkRolloverVaultsDcs(
    vaultAddresses: EvmAddress[],
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = this.loadCegaEntry();
    return cegaEntry.bulkRolloverDCSVaults(vaultAddresses, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  /**
   * DISPUTE METHODS
   */

  async submitDispute(vaultAddress: EvmAddress): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = this.loadCegaEntry();
    return cegaEntry.submitDispute(vaultAddress);
  }

  async processTradeDisputeDcs(
    vaultAddress: EvmAddress,
    newPrice: ethers.BigNumber,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = this.loadCegaEntry();
    return cegaEntry.processTradeDispute(vaultAddress, newPrice, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  /**
   * CRANK METHODS
   */

  async bulkCheckAuctionDefaultDcs(
    vaultAddresses: EvmAddress[],
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = this.loadCegaEntry();
    return cegaEntry.bulkCheckDCSAuctionDefault(vaultAddresses, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async bulkCheckSettlementDefaultDcs(
    vaultAddresses: EvmAddress[],
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = this.loadCegaEntry();
    return cegaEntry.bulkCheckDCSSettlementDefault(vaultAddresses, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async bulkCheckTradeExpiryDcs(
    vaultAddresses: EvmAddress[],
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = this.loadCegaEntry();
    return cegaEntry.bulkCheckDCSTradesExpiry(vaultAddresses, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }
}

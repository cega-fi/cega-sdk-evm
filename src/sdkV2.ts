import { BigNumberish, ethers } from 'ethers';
import { EvmAddress, OracleDataSource, TxOverrides } from './types';
import { GasStation } from './GasStation';

import Erc20Abi from './abi/ERC20.json';
import ICegaCombinedEntry from './abiV2/ICegaCombinedEntry.json';
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
    return new ethers.Contract(
      cegaEntryAddress,
      ICegaCombinedEntry.abi,
      this._signer || this._provider,
    );
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
   * COMMON GETTER METHODS
   */

  async getIsProtocolPaused(): Promise<boolean> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.getIsProtocolPaused();
  }

  async getLatestProductId(): Promise<number> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.getLatestProductId();
  }

  async getProductMetadata(productId: ethers.BigNumberish) {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.getProductMetadata(productId);
  }

  async getVault(vaultAddress: EvmAddress) {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.getVault(vaultAddress);
  }

  async getVaultTotalAssets(vaultAddress: EvmAddress) {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.totalAssets(vaultAddress);
  }

  async getStrategyOfProduct(productId: ethers.BigNumberish): Promise<number> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.getStrategyOfProduct(productId);
  }

  /**
   * COMMON CONFIG SETTER METHODS
   */

  async setProductName(
    productId: ethers.BigNumberish,
    name: string,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.setProductName(productId, name, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async setTradeWinnerNftImage(
    productId: ethers.BigNumberish,
    imageUrl: string,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.setTradeWinnerNftImage(productId, imageUrl, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async setManagementFee(
    vaultAddress: EvmAddress,
    managementFeeBps: number,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.setManagementFee(vaultAddress, managementFeeBps, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async setYieldFee(
    vaultAddress: EvmAddress,
    yieldFeeBps: number,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.setYieldFee(vaultAddress, yieldFeeBps, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  /**
   * DCS GETTER METHODS
   */

  async dcsGetProduct(productId: ethers.BigNumberish) {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.dcsGetProduct(productId);
  }

  async dcsGetVault(vaultAddress: EvmAddress) {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.dcsGetVault(vaultAddress);
  }

  async dcsCalculateLateFee(vaultAddress: EvmAddress) {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.dcsCalculateLateFee(vaultAddress);
  }

  async dcsIsWithdrawalPossible(vaultAddress: EvmAddress): Promise<boolean> {
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

  async dcsGetProductDepositAsset(productId: ethers.BigNumberish) {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.dcsGetProductDepositAsset(productId);
  }

  async dcsGetVaultSettlementAsset(vaultAddress: EvmAddress) {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.dcsGetVaultSettlementAsset(vaultAddress);
  }

  async dcsCalculateVaultFinalPayoff(vaultAddress: EvmAddress) {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.dcsCalculateVaultFinalPayoff(vaultAddress);
  }

  /**
   * FCN GETTER METHODS
   */

  async fcnGetBondAllowList(receiver: EvmAddress): Promise<boolean> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.fcnGetBondAllowList(receiver);
  }

  async fcnGetProduct(productId: ethers.BigNumberish) {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.fcnGetProduct(productId);
  }

  async fcnGetProductDepositAsset(productId: ethers.BigNumberish): Promise<EvmAddress> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.fcnGetProductDepositAsset(productId);
  }

  async fcnGetVault(vaultAddress: EvmAddress) {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.fcnGetVault(vaultAddress);
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

  /**
   * @deprecated increaseAllowanceErc20 should not be used. Use approveErc20 instead
   */
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

  /**
   * @deprecated increaseAllowanceErc20ForCegaEntry should not be used.
   * Use approveErc20ForCegaEntry instead
   */
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

  /**
   * @deprecated increaseAllowanceErc20ForCegaProxy should not be used.
   * Use approveErc20ForCegaProxy instead
   */
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

  async addToDepositQueue(
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
      return this.addToDepositQueueProxy(productId, amount, overrides);
    }

    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.addToDepositQueue(productId, amount, await this._signer.getAddress(), {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
      value: asset === ethers.constants.AddressZero ? amount : 0,
    });
  }

  /**
   * @deprecated instead use `addToDepositQueue`
   */
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

  private async addToDepositQueueProxy(
    productId: ethers.BigNumberish,
    amount: ethers.BigNumber,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    if (!this._signer) {
      throw new Error('Signer not defined');
    }
    const proxyEntry = await this.loadCegaWrappingProxy();
    return proxyEntry.wrapAndAddToDepositQueue(productId, amount, await this._signer.getAddress(), {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  /**
   * @deprecated instead use `addToDepositQueueProxy`
   */
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

  async addToWithdrawalQueue(
    vaultAddress: EvmAddress,
    sharesAmount: ethers.BigNumber,
    withWrappingProxy: boolean,
    nextProductId: ethers.BigNumberish = 0,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    if (withWrappingProxy) {
      return this.addToWithdrawalQueueProxy(vaultAddress, sharesAmount, overrides);
    }

    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.addToWithdrawalQueue(vaultAddress, sharesAmount, nextProductId, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  private async addToWithdrawalQueueProxy(
    vaultAddress: EvmAddress,
    sharesAmount: ethers.BigNumber,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    if (!this._signer) {
      throw new Error('Signer not defined');
    }

    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.addToWithdrawalQueueWithProxy(
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
   * @deprecated instead use the strategy generic `addToWithdrawalQueue`
   */
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

  /**
   * @deprecated instead use the strategy generic `addToWithdrawalQueueProxy`
   */
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

    // TODO: asked SC to reorder these params to be consistent with FCN
    return cegaEntry.dcsSetIsDepositQueueOpen(isDepositQueueOpen, productId, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async fcnSetIsDepositQueueOpen(
    productId: ethers.BigNumberish,
    isDepositQueueOpen: boolean,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();

    return cegaEntry.fcnSetIsDepositQueueOpen(productId, isDepositQueueOpen, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async bulkOpenVaultDeposits(
    vaultAddresses: EvmAddress[],
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.bulkOpenVaultDeposits(vaultAddresses, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  /**
   * @deprecated instead use `bulkOpenVaultDeposits`
   */
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

  async fcnBulkProcessDepositQueues(
    vaultAddresses: EvmAddress[],
    maxProcessCount: ethers.BigNumberish,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.fcnBulkProcessDepositQueues(vaultAddresses, maxProcessCount, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async dcsEndAuction(
    vaultAddress: EvmAddress,
    auctionWinner: EvmAddress,
    tradeStartDate: Date,
    aprBps: number,
    oracleDataSource: OracleDataSource,
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

  async fcnEndAuction(
    vaultAddress: EvmAddress,
    auctionWinner: EvmAddress,
    tradeStartDate: Date,
    aprBps: number,
    oracleDataSources: OracleDataSource[],
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    const tradeStartInSeconds = Math.floor(tradeStartDate.getTime() / 1000);

    return cegaEntry.fcnEndAuction(
      vaultAddress,
      auctionWinner,
      tradeStartInSeconds,
      aprBps,
      oracleDataSources,
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

  async fcnBulkStartTrades(
    vaultAddresses: EvmAddress[],
    nativeAssetTransferSummedAmount?: ethers.BigNumber,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.fcnBulkStartTrades(vaultAddresses, {
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

  async fcnBulkSettleVaults(
    vaultAddresses: EvmAddress[],
    nativeAssetTransferSummedAmount?: ethers.BigNumber,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.fcnBulkSettleVaults(vaultAddresses, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
      value: nativeAssetTransferSummedAmount ?? 0,
    });
  }

  async fcnBulkRepayBonds(
    vaultAddresses: EvmAddress[],
    amounts: ethers.BigNumber[],
    nativeAssetTransferSummedAmount?: ethers.BigNumber,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.fcnBulkRepayBonds(vaultAddresses, amounts, {
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

  async fcnBulkCollectFees(
    vaultAddresses: EvmAddress[],
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.fcnBulkCollectVaultFees(vaultAddresses, {
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

  async fcnBulkProcessWithdrawalQueues(
    vaultAddresses: EvmAddress[],
    maxProcessCount: ethers.BigNumberish,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.fcnBulkProcessWithdrawalQueues(vaultAddresses, maxProcessCount, {
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

  async fcnBulkRolloverVaults(
    vaultAddresses: EvmAddress[],
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.fcnBulkRolloverVaults(vaultAddresses, {
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

  async fcnSubmitDispute(
    vaultAddress: EvmAddress,
    barrierIndex: number,
    overrideDateTime: Date,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    const overrideDateInSeconds = Math.floor(overrideDateTime.getTime() / 1000);
    return cegaEntry.fcnSubmitDispute(vaultAddress, barrierIndex, overrideDateInSeconds, {
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

  async fcnProcessTradeDispute(
    vaultAddress: EvmAddress,
    barrierIndex: number,
    overrideDateTime: Date,
    newPrice: ethers.BigNumber,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    const overrideDateInSeconds = Math.floor(overrideDateTime.getTime() / 1000);
    return cegaEntry.fcnProcessTradeDispute(
      vaultAddress,
      barrierIndex,
      overrideDateInSeconds,
      newPrice,
      {
        ...(await this._gasStation.getGasOraclePrices()),
        ...overrides,
      },
    );
  }

  async getOraclePriceOverride(
    vaultAddress: EvmAddress,
    overrideDateTime: Date,
  ): Promise<ethers.BigNumber> {
    const cegaEntry = await this.loadCegaEntry();
    const overrideDateInSeconds = Math.floor(overrideDateTime.getTime() / 1000);
    return cegaEntry.getOraclePriceOverride(vaultAddress, overrideDateInSeconds);
  }

  /**
   * @deprecated instead use generic function `getOraclePriceOverride`
   */
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
    yieldFeeBps = 0,
    managementFeeBps = 0,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.dcsCreateVault(
      productId,
      {
        tokenName,
        tokenSymbol,
        yieldFeeBps,
        managementFeeBps,
      },
      {
        ...(await this._gasStation.getGasOraclePrices()),
        ...overrides,
      },
    );
  }

  async fcnCreateVault(
    productId: ethers.BigNumberish,
    tokenName: string,
    tokenSymbol: string,
    yieldFeeBps = 0,
    managementFeeBps = 0,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.fcnCreateVault(
      productId,
      {
        tokenName,
        tokenSymbol,
        yieldFeeBps,
        managementFeeBps,
      },
      {
        ...(await this._gasStation.getGasOraclePrices()),
        ...overrides,
      },
    );
  }

  /**
   * @deprecated instead use the generic setManagementFee function
   */
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

  /**
   * @deprecated instead use the generic setYieldFee function
   */
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

    // TODO: asked SC to reorder these params to be consistent with FCN
    return cegaEntry.dcsSetMaxUnderlyingAmount(maxUnderlyingAmount, productId, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async fcnSetMaxUnderlyingAmount(
    productId: ethers.BigNumberish,
    maxUnderlyingAmount: ethers.BigNumberish,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();

    return cegaEntry.fcnSetMaxUnderlyingAmount(productId, maxUnderlyingAmount, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async dcsSetMinDepositAmount(
    productId: ethers.BigNumberish,
    minDepositAmount: ethers.BigNumber,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();

    // TODO: asked SC to reorder these params to be consistent with FCN
    return cegaEntry.dcsSetMinDepositAmount(minDepositAmount, productId, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async fcnSetMinDepositAmount(
    productId: ethers.BigNumberish,
    minDepositAmount: ethers.BigNumber,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();

    return cegaEntry.fcnSetMinDepositAmount(productId, minDepositAmount, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async dcsSetDaysToStartLateFees(
    productId: ethers.BigNumberish,
    daysToStartLateFees: number,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();

    return cegaEntry.dcsSetDaysToStartLateFees(productId, daysToStartLateFees, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async dcsSetLateFeeBps(
    productId: ethers.BigNumberish,
    lateFeeBps: number,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();

    // TODO: asked SC to reorder these params to be consistent with FCN
    return cegaEntry.dcsSetLateFeeBps(lateFeeBps, productId, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async fcnSetLateFeeBps(
    productId: ethers.BigNumberish,
    lateFeeBps: number,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();

    return cegaEntry.fcnSetLateFeeBps(productId, lateFeeBps, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async dcsSetDaysToStartAuctionDefault(
    productId: ethers.BigNumberish,
    daysToStartAuctionDefault: number,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();

    return cegaEntry.dcsSetDaysToStartAuctionDefault(productId, daysToStartAuctionDefault, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async fcnSetDaysToStartAuctionDefault(
    productId: ethers.BigNumberish,
    daysToStartAuctionDefault: number,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();

    return cegaEntry.fcnSetDaysToStartAuctionDefault(productId, daysToStartAuctionDefault, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async dcsSetDaysToStartSettlementDefault(
    productId: ethers.BigNumberish,
    daysToStartSettlementDefault: number,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();

    return cegaEntry.dcsSetDaysToStartSettlementDefault(productId, daysToStartSettlementDefault, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async fcnSetDaysToStartSettlementDefault(
    productId: ethers.BigNumberish,
    daysToStartSettlementDefault: number,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();

    return cegaEntry.fcnSetDaysToStartSettlementDefault(productId, daysToStartSettlementDefault, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async dcsSetDisputePeriodInHours(
    productId: ethers.BigNumberish,
    disputePeriodInHours: number,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();

    return cegaEntry.dcsSetDisputePeriodInHours(productId, disputePeriodInHours, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async fcnSetDisputePeriodInHours(
    productId: ethers.BigNumberish,
    disputePeriodInHours: number,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();

    return cegaEntry.fcnSetDisputePeriodInHours(productId, disputePeriodInHours, {
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

  async fcnBulkCheckAuctionDefault(
    vaultAddresses: EvmAddress[],
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.fcnBulkCheckAuctionDefault(vaultAddresses, {
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

  async fcnBulkCheckSettlementDefault(
    vaultAddresses: EvmAddress[],
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.fcnBulkCheckSettlementDefault(vaultAddresses, {
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

  async fcnBulkCheckTradesExpiry(
    vaultAddresses: EvmAddress[],
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = await this.loadCegaEntry();
    return cegaEntry.fcnBulkCheckTradesExpiry(vaultAddresses, {
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
    oracleDataSource: OracleDataSource = OracleDataSource.Pyth,
  ): Promise<ethers.BigNumber> {
    const oracleEntry = await this.loadOracleEntry();
    return oracleEntry.getPrice(baseAsset, quoteAsset, timestamp, oracleDataSource);
  }

  async getSingleOraclePrice(
    asset: EvmAddress,
    timestamp: number,
    oracleDataSource: OracleDataSource = OracleDataSource.Pyth,
  ): Promise<ethers.BigNumber> {
    const oracleEntry = await this.loadOracleEntry();
    return oracleEntry.getSinglePrice(asset, timestamp, oracleDataSource);
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

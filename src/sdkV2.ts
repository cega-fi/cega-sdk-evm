import { ethers } from 'ethers';
import { EvmAddress, TxOverrides } from './types';
import { GasStation } from './GasStation';

import Erc20Abi from './abi/ERC20.json';
import IDCSEntryAbi from './abiV2/IDCSEntry.json';

export default class CegaEvmSDKV2 {
  private _provider: ethers.providers.Provider;

  private _signer: ethers.Signer | undefined;

  private _gasStation: GasStation;

  private _cegaEntryAddress: EvmAddress;

  constructor(
    cegaEntryAddress: EvmAddress,
    gasStation: GasStation,
    provider: ethers.providers.Provider,
    signer: ethers.Signer | undefined = undefined,
  ) {
    this._provider = provider;
    this._signer = signer;
    this._gasStation = gasStation;
    this._cegaEntryAddress = cegaEntryAddress;
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

  async approveDepositDcs(
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

  async addToDepositQueueDcs(
    productId: ethers.BigNumberish,
    amount: ethers.BigNumber,
    asset: EvmAddress = ethers.constants.AddressZero,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    if (!this._signer) {
      throw new Error('Signer not defined');
    }

    const cegaEntry = this.loadCegaEntry();
    return cegaEntry.addToDCSDepositQueue(productId, amount, await this._signer.getAddress(), {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
      value: asset === ethers.constants.AddressZero ? amount : 0,
    });
  }

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

  async bulkSettleVaultsDcs(
    vaultAddresses: EvmAddress[],
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = this.loadCegaEntry();
    return cegaEntry.bulkSettleDCSVaults(vaultAddresses);
  }

  async bulkStartTradesDcs(
    vaultAddresses: EvmAddress[],
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaEntry = this.loadCegaEntry();
    return cegaEntry.bulkStartDCSTrades(vaultAddresses);
  }
}

import { ethers } from 'ethers';
import { EvmAddress } from './types';
import PendlePYLpOracleAbi from './abiPendle/PendlePYLpOracle.json';
import PendleAdapter from './abiV2/PendleAdapter.json';

export default class PendleSdk {
  private _provider: ethers.providers.Provider;

  private _signer: ethers.Signer | undefined;

  // PendlePYLpOracle address (Pendle Deployer)
  // https://arbiscan.io/address/0x14418800e0b4c971905423aa873e83355922428c
  // https://etherscan.io/address/0x14418800e0b4c971905423aa873e83355922428c
  private _pendlePYLpOracleAddress: EvmAddress | undefined;

  private _pendleAdapterAddress: EvmAddress | undefined;

  constructor(
    provider: ethers.providers.Provider,
    pendlePYLpOracleAddress: EvmAddress | undefined = undefined,
    pendleAdapterAddress: EvmAddress | undefined = undefined,
    signer: ethers.Signer | undefined = undefined,
  ) {
    this._provider = provider;
    this._pendlePYLpOracleAddress = pendlePYLpOracleAddress;
    this._pendleAdapterAddress = pendleAdapterAddress;
    this._signer = signer;
  }

  setProvider(provider: ethers.providers.Provider) {
    this._provider = provider;
  }

  setSigner(signer: ethers.Signer) {
    this._signer = signer;
  }

  async loadPendleOracle(): Promise<ethers.Contract> {
    if (!this._pendlePYLpOracleAddress) {
      throw new Error('pendlePYLpOracleAddress not defined');
    }
    return new ethers.Contract(
      this._pendlePYLpOracleAddress,
      PendlePYLpOracleAbi.abi,
      this._signer || this._provider,
    );
  }

  async loadPendleAdapter(): Promise<ethers.Contract> {
    if (!this._pendleAdapterAddress) {
      throw new Error('pendleAdapterAddress not defined');
    }
    return new ethers.Contract(
      this._pendleAdapterAddress,
      PendleAdapter.abi,
      this._signer || this._provider,
    );
  }

  async pendleGetYtToAssetRate(
    assetAddresses: { baseAsset: EvmAddress; quoteAsset: EvmAddress },
    duration: number,
  ): Promise<ethers.BigNumber> {
    const pendleOracle = await this.loadPendleOracle();
    const pendleAdapter = await this.loadPendleAdapter();

    const { baseAsset, quoteAsset } = assetAddresses;
    const market = await pendleAdapter.assetsToMarket(baseAsset, quoteAsset);

    const price = await pendleOracle.getYtToAssetRate(market, duration);

    return price;
  }
}

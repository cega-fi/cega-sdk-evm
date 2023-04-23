import { GasOraclePrice } from '../types';

export class GasStation {
  protected _cacheValidityInMs: number;

  protected _cacheLastUpdatedAt: Date | null;

  protected _cacheLastValue: GasOraclePrice | null;

  constructor(cacheValidityInMs = 10000) {
    this._cacheValidityInMs = cacheValidityInMs;
    this._cacheLastUpdatedAt = null;
    this._cacheLastValue = null;
  }

  isCacheValid() {
    return (
      this._cacheLastUpdatedAt !== null &&
      new Date().getTime() - this._cacheLastUpdatedAt.getTime() < this._cacheValidityInMs
    );
  }

  purgeCache() {
    this._cacheLastUpdatedAt = null;
    this._cacheLastValue = null;
  }

  /**
   * Override `updateCacheValue` to extend GasStation functionality
   * for dynamic gas price setting
   */
  async updateCacheValue(): Promise<void> {
    this._cacheLastValue = {};
  }

  async updateCache(): Promise<void> {
    await this.updateCacheValue();
    this._cacheLastUpdatedAt = new Date();
  }

  async getGasOraclePrices(): Promise<GasOraclePrice> {
    if (!this.isCacheValid()) {
      await this.updateCache();
    }
    return this._cacheLastValue !== null ? this._cacheLastValue : {};
  }
}

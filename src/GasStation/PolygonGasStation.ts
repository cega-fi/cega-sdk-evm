import { GasStation } from './GasStation';

export class PolygonGasStation extends GasStation {
  async updateCacheValue(): Promise<void> {
    this._cacheLastValue = {
      gasPrice: 1e12,
    };
  }
}

import axios from 'axios';

import { GasStation } from './GasStation';

async function fetchAlchemy(apiKey: string) {
  const response = await axios({
    url: `https://arb-mainnet.g.alchemy.com/v2/${apiKey}`,
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    data: { id: 1, jsonrpc: '2.0' },
  });
  const { result } = response.data;
  return {
    maxPriorityFeePerGas: parseInt(result, 16),
  };
}

export class ArbitrumAlchemyGasStation extends GasStation {
  protected apiKey: string;

  constructor(apiKey: string, cacheValidityInMs = 10000) {
    super(cacheValidityInMs);
    this.apiKey = apiKey;
  }

  async updateCacheValue(): Promise<void> {
    const alchemyResult = await fetchAlchemy(this.apiKey);

    this._cacheLastValue = {
      maxPriorityFeePerGas: alchemyResult.maxPriorityFeePerGas,
    };
  }
}

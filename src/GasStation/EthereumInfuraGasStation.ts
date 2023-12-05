import axios from 'axios';

import { GasStation } from './GasStation';

async function fetchInfura(apiKey: string) {
  const response = await axios({
    url: `https://mainnet.infura.io/v3/${apiKey}`,
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    data: { id: 1, jsonrpc: '2.0', method: 'eth_maxPriorityFeePerGas' },
  });
  const { result } = response.data;
  return {
    maxPriorityFeePerGas: parseInt(result, 16),
  };
}

export class EthereumInfuraGasStation extends GasStation {
  protected apiKey: string;

  constructor(apiKey: string, cacheValidityInMs = 10000) {
    super(cacheValidityInMs);
    this.apiKey = apiKey;
  }

  async updateCacheValue(): Promise<void> {
    const infuraResult = await fetchInfura(this.apiKey);

    this._cacheLastValue = {
      maxPriorityFeePerGas: infuraResult.maxPriorityFeePerGas,
    };
  }
}

import axios from 'axios';

import { ethers } from 'ethers';
import { GasStation } from './GasStation';
import { Modes } from './modes';

async function fetchEtherscan(apiKey: string) {
  const response = await axios.get('https://api.etherscan.io/api', {
    params: {
      module: 'gastracker',
      action: 'gasoracle',
      apikey: apiKey,
    },
  });
  const { result } = response.data;
  return result;
}

export class EthereumEtherscanGasStation extends GasStation {
  protected apiKey: string;

  protected mode: Modes;

  constructor(apiKey: string, cacheValidityInMs = 10000, mode = Modes.Fast) {
    super(cacheValidityInMs);
    this.apiKey = apiKey;
    this.mode = mode;
  }

  updateMode(newMode: Modes) {
    this.mode = newMode;
  }

  async updateCacheValue(): Promise<void> {
    const etherscanResult = await fetchEtherscan(this.apiKey);

    let gasPriceInGwei: string;
    if (this.mode === Modes.Slow) {
      gasPriceInGwei = etherscanResult.SlowGasPrice;
    } else if (this.mode === Modes.Average) {
      gasPriceInGwei = etherscanResult.ProposeGasPrice;
    } else {
      gasPriceInGwei = etherscanResult.FastGasPrice;
    }

    this._cacheLastValue = {
      gasPrice: ethers.utils.parseUnits(gasPriceInGwei, 'gwei'),
    };
  }
}

export enum NetworkName {
  EthereumMainnet = 'ethereum-mainnet',
  ArbitrumOneMainnet = 'arbitrum-one-mainnet',
}

export interface IChainConfig {
  id: number;
  name: string;
  tokens: Record<string, string>;
}

const Chains: Record<number, IChainConfig> = {
  1: {
    id: 1,
    name: NetworkName.EthereumMainnet,
    tokens: {
      stETH: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      wBTC: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    },
  },
  42161: {
    id: 42161,
    name: NetworkName.ArbitrumOneMainnet,
    tokens: {
      USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      wBTC: '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f',
    },
  },
};

export function isValidChain(chainId: number): boolean {
  return Chains[chainId] !== undefined;
}

export default Chains;

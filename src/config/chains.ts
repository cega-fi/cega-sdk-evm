export interface IChainConfig {
  id: number;
  name: string;
  tokens: Record<string, string>;
}

const Chains: Record<number, IChainConfig> = {
  1: {
    id: 1,
    name: 'ethereum-mainnet',
    tokens: {
      stETH: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    },
  },
  42161: {
    id: 42161,
    name: 'arbitrum-one-mainnet',
    tokens: {
      USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'
    },
  },
};

export function isValidChain(chainId: number): boolean {
  return Chains[chainId] !== undefined;
}

export default Chains;

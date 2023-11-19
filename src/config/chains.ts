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
    },
  },
  42161: {
    id: 42161,
    name: 'arbitrum-one-mainnet',
    tokens: {},
  },
};

export function isValidChain(chainId: number): boolean {
  return Chains[chainId] !== undefined;
}

export default Chains;

// eslint-disable-next-line import/no-extraneous-dependencies
import * as dotenv from 'dotenv';

import { ethers } from 'ethers';
import { CegaEvmSDKV2, EthereumAlchemyGasStation, types, GasStation } from '..';
import { OracleDataSourceDcs } from '../types';

dotenv.config();

enum NetworkType {
  ethereumQA = 'ethereumQA',
  arbitrumQA = 'arbitrumQA',
  ethereum = 'ethereum',
  arbitrum = 'arbitrum',
}

const ADMIN_ACCOUNTS = {
  programAdminPk: process.env.PROGRAM_ADMIN_PK || '',
  operatorAdminPk: process.env.OPERATOR_ADMIN_PK || '',
  traderAdminPk: process.env.TRADER_ADMIN_PK || '',
  serviceAdminPk: process.env.SERVICE_ADMIN_PK || '',
  userPk: process.env.RANDOM_USER_PK || '',
};

const CONFIGS: Record<string, any> = {
  ethereumQA: {
    RPC_URL: process.env.ETH_RPC_URL,
    addressManager: '0xD40a37ADc14f73579A073DF353a2f6118CF313F4' as types.EvmAddress,
    treasuryAddress: '0x13159257aE85276f30A7b3DD8f2fC724913265e0' as types.EvmAddress,
    usdcAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' as types.EvmAddress,
    stEth: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84' as types.EvmAddress,
    wsteth: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0' as types.EvmAddress,
    gasStation: new EthereumAlchemyGasStation(process.env.ETH_ALCHEMY_API_KEY || ''),
    pythAdapterAddress: '0x3d5d2745db503C3B40dB49AD1023ad9ae7379979' as types.EvmAddress,
  },
  arbitrumQA: {
    RPC_URL: process.env.ARBITRUM_RPC_URL,
    addressManager: '0x6E5679dCFE0113C0B335b4252046E268c4065a2d' as types.EvmAddress,
    treasuryAddress: '0xf97E73aDfFDb2532C9b15Df52265093B1c27Fa23' as types.EvmAddress,
    usdcAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as types.EvmAddress,
    stEth: '' as types.EvmAddress,
    wsteth: '0x5979D7b546E38E414F7E9822514be443A4800529' as types.EvmAddress,
    gasStation: new GasStation(),
    pythAdapterAddress: '0xa872D1Fd6E84b65998745738E094B03b0d18447c' as types.EvmAddress,
  },
  ethereum: {
    RPC_URL: process.env.ETH_RPC_URL,
    addressManager: '0x1DdF7C4C98a78b492bb4a2881358f183d94c9806' as types.EvmAddress,
    treasuryAddress: '0xA8AB795731fbBFDd1Fbc57ca11e6f722e7783642' as types.EvmAddress,
    usdcAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' as types.EvmAddress,
    stEth: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84' as types.EvmAddress,
    wsteth: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0' as types.EvmAddress,
    gasStation: new EthereumAlchemyGasStation(process.env.ETH_ALCHEMY_API_KEY || ''),
    pythAdapterAddress: '0x271AcA3E9b8Ed9F4F618875093bD75a7E1b3116C' as types.EvmAddress,
  },
  arbitrum: {
    RPC_URL: process.env.ARBITRUM_RPC_URL,
    addressManager: '0x25b7A20B8E9B0676E596eDF4329d38459c3f9a87' as types.EvmAddress,
    treasuryAddress: '0x475C4AF369B28997B25bd756eF92797AD3F69593' as types.EvmAddress,
    usdcAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as types.EvmAddress,
    stEth: '' as types.EvmAddress,
    wsteth: '0x5979D7b546E38E414F7E9822514be443A4800529' as types.EvmAddress,
    gasStation: new GasStation(),
    pythAdapterAddress: '0x939D97719dd97930d8D4C3b899e091CC7458E0Df' as types.EvmAddress,
  },
};

async function setMaxUnderlyingAmount(
  network: NetworkType,
  productId: ethers.BigNumberish,
  amount: ethers.BigNumberish,
) {
  const config = CONFIGS[network];
  const provider = new ethers.providers.JsonRpcProvider(config.RPC_URL);
  const signer = new ethers.Wallet(ADMIN_ACCOUNTS.traderAdminPk, provider);

  const sdk = new CegaEvmSDKV2(
    config.addressManager,
    config.treasuryAddress,
    config.gasStation,
    provider,
    signer,
  );

  const tx = await sdk.dcsSetMaxUnderlyingAmount(productId, amount, {
    gasLimit: network === NetworkType.ethereum ? 500000 : 1e7,
  });
  console.log('networkName: ', network, ', productId: ', productId, ', tx: ', tx.hash);
  const txResponse = await tx.wait();
}

async function addDeposits(network: NetworkType) {
  const config = CONFIGS[network];
  const provider = new ethers.providers.JsonRpcProvider(config.RPC_URL);
  const userSigner = new ethers.Wallet(ADMIN_ACCOUNTS.userPk, provider);

  const sdk = new CegaEvmSDKV2(
    config.addressManager,
    config.treasuryAddress,
    config.gasStation,
    provider,
    userSigner,
  );

  const product = await sdk.dcsGetProduct(1);
  console.log(product);
  const product2 = await sdk.dcsGetProduct(2);
  console.log(product2);
  const product3 = await sdk.dcsGetProduct(3);
  console.log(product3);

  await sdk.dcsSetIsDepositQueueOpen(1, true);

  let amount;
  let txResponse;
  let txReceipt;

  // // Deposit Ethereum
  // const ethereumProductId = 1;
  // // await sdk.dcsSetIsDepositQueueOpen(ethereumProductId, true);
  // amount = ethers.utils.parseUnits('0.00005', 18);
  // txResponse = await sdk.dcsAddToDepositQueue(ethereumProductId, amount);
  // console.log('Ethereum Deposit: ', txResponse.hash);

  // // open deposit queue
  // // Deposit ERC20
  // const usdcProductId = 2;
  // // await sdk.dcsSetIsDepositQueueOpen(usdcProductId, true);
  // amount = ethers.utils.parseUnits('0.1', 6);
  // txResponse = await sdk.increaseAllowanceErc20(amount, config.usdcAddress);
  // txReceipt = await txResponse.wait();
  // console.log('increaseAllowance USDC: ', txReceipt.transactionHash);
  // txResponse = await sdk.dcsAddToDepositQueue(usdcProductId, amount, config.usdcAddress);
  // console.log('deposit USDC: ', txResponse.hash);

  // // Deposit stETH on ethereum (via wrapping proxy)
  // const stethProductId = 3; // wrapped steth actually
  // // await sdk.dcsSetIsDepositQueueOpen(stethProductId, true);
  // amount = ethers.utils.parseUnits('0.00005', 18);
  // txResponse = await sdk.increaseAllowanceErc20(amount, config.stEth);
  // txReceipt = await txResponse.wait();
  // console.log('increaseAllowance stETH: ', txReceipt.transactionHash);
  // txResponse = await sdk.dcsAddToDepositQueue(stethProductId, amount, config.stEth);
  // console.log('deposit stETH: ', txResponse.hash);
}

async function bulkActions(network: 'ethereum' | 'arbitrum') {
  const config = CONFIGS[network];
  const provider = new ethers.providers.JsonRpcProvider(config.RPC_URL);
  const traderSigner = new ethers.Wallet(ADMIN_ACCOUNTS.traderAdminPk, provider);

  const sdk = new CegaEvmSDKV2(
    config.addressManager,
    config.treasuryAddress,
    config.gasStation,
    provider,
    traderSigner,
    config.pythAdapterAddress,
  );

  // Bulk Open Vault Deposits
  await sdk.dcsBulkOpenVaultDeposits([]);
}

async function main() {
  await setMaxUnderlyingAmount(
    NetworkType.ethereum,
    1,
    ethers.utils.parseUnits((1100 * 2).toString(), 18),
  );
  await setMaxUnderlyingAmount(
    NetworkType.ethereum,
    2,
    ethers.utils.parseUnits((1100 * 2).toString(), 18),
  );
  await setMaxUnderlyingAmount(
    NetworkType.ethereum,
    3,
    ethers.utils.parseUnits((1250 * 2).toString(), 18),
  );
  await setMaxUnderlyingAmount(
    NetworkType.ethereum,
    4,
    ethers.utils.parseUnits((1250 * 2).toString(), 18),
  );
  await setMaxUnderlyingAmount(
    NetworkType.ethereum,
    5,
    ethers.utils.parseUnits((2500000 * 2).toString(), 6),
  );

  await setMaxUnderlyingAmount(
    NetworkType.arbitrum,
    3,
    ethers.utils.parseUnits((1250 * 2).toString(), 18),
  );
  await setMaxUnderlyingAmount(
    NetworkType.arbitrum,
    4,
    ethers.utils.parseUnits((1250 * 2).toString(), 18),
  );
  await setMaxUnderlyingAmount(
    NetworkType.arbitrum,
    5,
    ethers.utils.parseUnits((2500000 * 2).toString(), 6),
  );
  await setMaxUnderlyingAmount(
    NetworkType.arbitrum,
    6,
    ethers.utils.parseUnits((1100 * 2).toString(), 18),
  );
  await setMaxUnderlyingAmount(
    NetworkType.arbitrum,
    7,
    ethers.utils.parseUnits((1100 * 2).toString(), 18),
  );

  // await addDeposits(CURRENT_NETWORK);
  // await bulkActions(CURRENT_NETWORK);
}

main();

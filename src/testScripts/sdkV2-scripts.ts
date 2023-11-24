// eslint-disable-next-line import/no-extraneous-dependencies
import * as dotenv from 'dotenv';

import { ethers } from 'ethers';
import { CegaEvmSDKV2, EthereumAlchemyGasStation, types, GasStation } from '..';

dotenv.config();

const ADMIN_ACCOUNTS = {
  programAdminPk: process.env.PROGRAM_ADMIN_PK || '',
  operatorAdminPk: process.env.OPERATOR_ADMIN_PK || '',
  traderAdminPk: process.env.TRADER_ADMIN_PK || '',
  serviceAdminPk: process.env.SERVICE_ADMIN_PK || '',
  userPk: process.env.RANDOM_USER_PK || '',
};

const CONFIGS = {
  ethereum: {
    RPC_URL: process.env.ETH_RPC_URL,
    addressManager: '0xD40a37ADc14f73579A073DF353a2f6118CF313F4' as types.EvmAddress,
    treasuryAddress: '0x13159257aE85276f30A7b3DD8f2fC724913265e0' as types.EvmAddress,
    usdcAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' as types.EvmAddress,
    stEth: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84' as types.EvmAddress,
    gasStation: new EthereumAlchemyGasStation(process.env.ETH_ALCHEMY_API_KEY || ''),
  },
  arbitrum: {
    RPC_URL: process.env.ARBITRUM_RPC_URL,
    addressManager: '0x6E5679dCFE0113C0B335b4252046E268c4065a2d' as types.EvmAddress,
    treasuryAddress: '0xf97E73aDfFDb2532C9b15Df52265093B1c27Fa23' as types.EvmAddress,
    usdcAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as types.EvmAddress,
    stEth: '' as types.EvmAddress,
    gasStation: new GasStation(),
  },
};

const CURRENT_NETWORK = 'arbitrum';

async function addDeposits(network: 'ethereum' | 'arbitrum') {
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
  );

  // Bulk Open Vault Deposits
  await sdk.dcsBulkOpenVaultDeposits([]);
}

async function main() {
  await addDeposits(CURRENT_NETWORK);
  // await bulkActions(CURRENT_NETWORK);
}

main();

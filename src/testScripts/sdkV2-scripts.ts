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
    cegaEntryAddress: '0x6891F6594Ec545077561Cc4Fa79a861db2cfBA9D' as types.EvmAddress,
    cegaWrappingProxyAddress: '0xd940d163b1C29F8a8bFc7dd6300a94fF47AaDECB' as types.EvmAddress,
    usdcAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' as types.EvmAddress,
    stEth: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84' as types.EvmAddress,
    gasStation: new EthereumAlchemyGasStation(process.env.ETH_ALCHEMY_API_KEY || ''),
  },
  arbitrum: {
    RPC_URL: process.env.ARBITRUM_RPC_URL,
    cegaEntryAddress: '0xb50dfbdd7d6aef83426b148a4f60c8fd33fd3033' as types.EvmAddress,
    cegaWrappingProxyAddress: '' as types.EvmAddress,
    usdcAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as types.EvmAddress,
    stEth: '' as types.EvmAddress,
    gasStation: new GasStation(),
  },
};

const CURRENT_NETWORK = 'ethereum';

async function addDeposits(network: 'ethereum' | 'arbitrum') {
  const config = CONFIGS[network];
  const provider = new ethers.providers.JsonRpcProvider(config.RPC_URL);
  const userSigner = new ethers.Wallet(ADMIN_ACCOUNTS.userPk, provider);

  const sdk = new CegaEvmSDKV2(
    config.cegaEntryAddress,
    config.cegaWrappingProxyAddress,
    config.gasStation,
    provider,
    userSigner,
  );

  // const product = await sdk.dcsGetProduct(1);
  // console.log(product);
  // const product2 = await sdk.dcsGetProduct(2);
  // console.log(product2);
  // const product3 = await sdk.dcsGetProduct(3);
  // console.log(product3);

  // open deposit queue
  // await sdk.dcsSetIsDepositQueueOpen(2, true);

  let amount;
  let txResponse;
  let txReceipt;

  // Deposit Ethereum
  const ethereumProductId = 1;
  // await sdk.dcsSetIsDepositQueueOpen(ethereumProductId, true);
  amount = ethers.utils.parseUnits('0.00005', 18);
  txResponse = await sdk.dcsAddToDepositQueue(ethereumProductId, amount);
  console.log('Ethereum Deposit: ', txResponse.hash);

  // open deposit queue
  // Deposit ERC20
  const usdcProductId = 2;
  // await sdk.dcsSetIsDepositQueueOpen(usdcProductId, true);
  amount = ethers.utils.parseUnits('0.1', 6);
  txResponse = await sdk.increaseAllowanceErc20(amount, config.usdcAddress);
  txReceipt = await txResponse.wait();
  console.log('increaseAllowance USDC: ', txReceipt.transactionHash);
  txResponse = await sdk.dcsAddToDepositQueue(usdcProductId, amount, config.usdcAddress);
  console.log('deposit USDC: ', txResponse.hash);

  // Deposit stETH on ethereum (via wrapping proxy)
  const stethProductId = 3; // wrapped steth actually
  // await sdk.dcsSetIsDepositQueueOpen(stethProductId, true);
  amount = ethers.utils.parseUnits('0.00005', 18);
  txResponse = await sdk.increaseAllowanceErc20(amount, config.stEth);
  txReceipt = await txResponse.wait();
  console.log('increaseAllowance stETH: ', txReceipt.transactionHash);
  txResponse = await sdk.dcsAddToDepositQueue(stethProductId, amount, config.stEth);
  console.log('deposit stETH: ', txResponse.hash);
}

async function bulkActions(network: 'ethereum' | 'arbitrum') {
  const config = CONFIGS[network];
  const provider = new ethers.providers.JsonRpcProvider(config.RPC_URL);
  const traderSigner = new ethers.Wallet(ADMIN_ACCOUNTS.traderAdminPk, provider);

  const sdk = new CegaEvmSDKV2(
    config.cegaEntryAddress,
    config.cegaWrappingProxyAddress,
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

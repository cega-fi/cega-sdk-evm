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
    addressManager: '0x1DdF7C4C98a78b492bb4a2881358f183d94c9806' as types.EvmAddress,
    treasuryAddress: '0xA8AB795731fbBFDd1Fbc57ca11e6f722e7783642' as types.EvmAddress,
    usdcAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' as types.EvmAddress,
    stEth: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84' as types.EvmAddress,
    gasStation: new EthereumAlchemyGasStation(process.env.ETH_ALCHEMY_API_KEY || ''),
    // pythAdapterAddress: '0x3d5d2745db503C3B40dB49AD1023ad9ae7379979' as types.EvmAddress,
  },
  arbitrum: {
    RPC_URL: process.env.ARBITRUM_RPC_URL,
    addressManager: '0x25b7A20B8E9B0676E596eDF4329d38459c3f9a87' as types.EvmAddress,
    treasuryAddress: '0x475C4AF369B28997B25bd756eF92797AD3F69593' as types.EvmAddress,
    usdcAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as types.EvmAddress,
    stEth: '' as types.EvmAddress,
    gasStation: new GasStation(),
    // pythAdapterAddress: '0xa872D1Fd6E84b65998745738E094B03b0d18447c' as types.EvmAddress,
  },
};

const CURRENT_NETWORK = 'arbitrum';

const vaultsToSettle = {
  ethereum: [],
  arbitrum: [],
};

async function settleDcs(network: 'ethereum' | 'arbitrum') {
  const config = CONFIGS[network];
  const provider = new ethers.providers.JsonRpcProvider(config.RPC_URL);
  const userSigner = new ethers.Wallet(ADMIN_ACCOUNTS.traderAdminPk, provider);

  const sdk = new CegaEvmSDKV2(
    config.addressManager,
    config.treasuryAddress,
    config.gasStation,
    provider,
    userSigner,
  );

  const txCollectFees = await sdk.dcsBulkCollectFees(vaultsToSettle[network], {
    gasLimit: 10e6,
  });
  console.log('collect fees: starting', txCollectFees.hash);
  const txCollectFeesResponse = await txCollectFees.wait();
  console.log('collect fees: done');

  const txProcessWithdrawals = await sdk.dcsBulkProcessWithdrawalQueues(
    vaultsToSettle[network],
    50,
    {
      gasLimit: 10e6,
    },
  );
  console.log('process withdrawals: starting', txProcessWithdrawals.hash);
  const txProcessWithdrawalsResponse = await txProcessWithdrawals.wait();
  console.log('process withdrawals: done');

  const txRollover = await sdk.dcsBulkRolloverVaults(vaultsToSettle[network], {
    gasLimit: 10e6,
  });
  console.log('collect fees: starting', txRollover.hash);
  const txRolloverResponse = await txRollover.wait();
  console.log('collect fees: done');
}

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
    config.pythAdapterAddress,
  );

  // Bulk Open Vault Deposits
  await sdk.dcsBulkOpenVaultDeposits([]);
}

async function main() {
  // await addDeposits(CURRENT_NETWORK);
  // await bulkActions(CURRENT_NETWORK);

  // settleDcs('ethereum');
  await settleDcs('arbitrum');
}

main();

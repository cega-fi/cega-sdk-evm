// eslint-disable-next-line import/no-extraneous-dependencies
import * as dotenv from 'dotenv';

import { ethers } from 'ethers';
import { CegaEvmSDKV2, EthereumAlchemyGasStation, types, GasStation } from '..';

dotenv.config();

const config = {
  ethereum: {
    RPC_URL: process.env.ETH_RPC_URL,
    cegaEntryAddress: '' as types.EvmAddress,
    usdcAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' as types.EvmAddress,
    gasStation: new EthereumAlchemyGasStation(process.env.ETH_ALCHEMY_API_KEY || ''),
  },
  arbitrum: {
    RPC_URL: process.env.ARBITRUM_RPC_URL,
    cegaEntryAddress: '0x10a5524f7c4e2fc62a1106e77cb8a53026bca252' as types.EvmAddress,
    usdcAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as types.EvmAddress,
    gasStation: new GasStation(),
  },
};

const CURRENT_NETWORK = 'arbitrum';
const { cegaEntryAddress, RPC_URL, gasStation } = config[CURRENT_NETWORK];

const ADMIN_ACCOUNTS = {
  programAdminPk: process.env.PROGRAM_ADMIN_PK || '',
  operatorAdminPk: process.env.OPERATOR_ADMIN_PK || '',
  traderAdminPk: process.env.TRADER_ADMIN_PK || '',
  serviceAdminPk: process.env.SERVICE_ADMIN_PK || '',
  userPk: process.env.RANDOM_USER_PK || '',
};

async function addDeposits() {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const userSigner = new ethers.Wallet(ADMIN_ACCOUNTS.userPk, provider);

  const sdk = new CegaEvmSDKV2(cegaEntryAddress, gasStation, provider, userSigner);

  // const product = await sdk.getProductDcs(2);
  // const product2 = await sdk.getProductDcs(2);
  // const product3 = await sdk.getProductDcs(3);

  // open deposit queue
  // await sdk.setIsDepositQueueOpenDcs(2, true);

  // Deposit Ethereum
  // const amount = ethers.utils.parseUnits('0.001', 18);
  // const txResponse = await sdk.addToDepositQueueDcs(2, amount);
  // console.log('Ethereum Deposit: ', txResponse.hash);

  // open deposit queue
  await sdk.setIsDepositQueueOpenDcs(1, true);
  // Deposit ERC20
  const amountUsdc = ethers.utils.parseUnits('0.1', 6);
  const approveTx = await sdk.approveDepositDcs(amountUsdc, config.arbitrum.usdcAddress);
  const approveResponse = await approveTx.wait();
  console.log('approve USDC: ', approveResponse.transactionHash);
  const depositTx = await sdk.addToDepositQueueDcs(1, amountUsdc, config.arbitrum.usdcAddress);
  console.log('deposit USDC: ', depositTx.hash);
}

async function bulkActions() {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const traderSigner = new ethers.Wallet(ADMIN_ACCOUNTS.traderAdminPk, provider);

  const sdk = new CegaEvmSDKV2(cegaEntryAddress, gasStation, provider, traderSigner);
}

async function main() {
  await addDeposits();
  // await bulkActions();
}

main();

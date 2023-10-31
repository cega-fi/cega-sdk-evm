// eslint-disable-next-line import/no-extraneous-dependencies
import * as dotenv from 'dotenv';

import { ethers } from 'ethers';
import { CegaEvmSDKV2, EthereumAlchemyGasStation, ArbitrumAlchemyGasStation, types } from '..';

dotenv.config();

const config = {
  ethereum: {
    RPC_URL: process.env.ETH_RPC_URL,
    cegaEntryAddress: '0x0730AA138062D8Cc54510aa939b533ba7c30f26B' as types.EvmAddress,
    gasStation: new EthereumAlchemyGasStation(process.env.ETH_ALCHEMY_API_KEY || ''),
  },
  arbitrum: {
    RPC_URL: process.env.ARBITRUM_RPC_URL,
    cegaEntryAddress: '0x4a2ecDe314080D37d4654cf0eb7DBe6d1BC89211' as types.EvmAddress,
    gasStation: new ArbitrumAlchemyGasStation(process.env.ARBITRUM_ALCHEMY_API_KEY || ''),
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

  // Deposit Ethereum
  // await sdk.addToDepositQueueDcs()

  // Deposit ERC20
  // await sdk.approveDepositDcs()
  // await sdk.addToDepositQueueDcs()
}

async function bulkActions() {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const traderSigner = new ethers.Wallet(ADMIN_ACCOUNTS.traderAdminPk, provider);

  const sdk = new CegaEvmSDKV2(cegaEntryAddress, gasStation, provider, traderSigner);

  // Bulk Open Vault Deposits
  // await sdk.bulkOpenVaultDepositsDcs()
}

async function main() {
  await addDeposits();
  await bulkActions();
}

main();

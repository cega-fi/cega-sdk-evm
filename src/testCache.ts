import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import CegaEvmSDK from './sdk';
import { GasStation } from './GasStation';

dotenv.config();

const { ETH_RPC_URL, ARBITRUM_RPC_URL, ETH_TRADER_ADMIN_PK, ARBITRUM_TRADER_ADMIN_PK } =
  process.env;
const ETH_CEGA_STATE_ADDRESS = '0x0730AA138062D8Cc54510aa939b533ba7c30f26B';
const ARB_CEGA_STATE_ADDRESS = '0xc809B7F21250B1ce0a61b7Fb645AEf5CE7c1B5ed';
const productNames = ['puppy-lov', 'supercharger-lov'];

(async () => {
  const arbProvider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC_URL);
  const arbSdk = new CegaEvmSDK(
    ARB_CEGA_STATE_ADDRESS,
    new GasStation(),
    arbProvider,
    new ethers.Wallet(ARBITRUM_TRADER_ADMIN_PK!, arbProvider),
  );

  const ethProvider = new ethers.providers.JsonRpcProvider(ETH_RPC_URL);
  const ethSdk = new CegaEvmSDK(
    ETH_CEGA_STATE_ADDRESS,
    new GasStation(),
    ethProvider,
    new ethers.Wallet(ETH_TRADER_ADMIN_PK!, ethProvider),
  );

  console.log('arb cache before:');
  arbSdk.logCache();
  console.log('eth cache before:');
  ethSdk.logCache();

  for (const productName of productNames) {
    await arbSdk.getProductAddress(productName);
  }
  console.log('arb cache after:');
  arbSdk.logCache();
  console.log('eth cache after:');
  ethSdk.logCache();
})();

/* eslint-disable no-await-in-loop */
// eslint-disable-next-line import/no-extraneous-dependencies
import * as dotenv from 'dotenv';
import fs from 'fs';

import { BigNumber, ethers } from 'ethers';
import { CegaEvmSDKV2, EthereumAlchemyGasStation, types, GasStation } from '..';
import { EvmAddress } from '../types';

dotenv.config();

const ADMIN_ACCOUNTS = {
  programAdminPk: process.env.PROGRAM_ADMIN_PK || '',
  operatorAdminPk: process.env.OPERATOR_ADMIN_PK || '',
  traderAdminPk: process.env.TRADER_ADMIN_PK || '',
  serviceAdminPk: process.env.SERVICE_ADMIN_PK || '',
  userPk: process.env.RANDOM_USER_PK || '',
};

enum Network {
  ethereum = 'ethereum',
  ethereum_qa = 'ethereum_qa',
  arbitrum = 'arbitrum',
}

const CONFIGS: Record<Network, any> = {
  ethereum: {
    RPC_URL: process.env.ETH_RPC_URL,
    addressManager: '0x1DdF7C4C98a78b492bb4a2881358f183d94c9806' as types.EvmAddress,
    treasuryAddress: '0xA8AB795731fbBFDd1Fbc57ca11e6f722e7783642' as types.EvmAddress,
    usdcAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' as types.EvmAddress,
    stEth: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84' as types.EvmAddress,
    gasStation: new EthereumAlchemyGasStation(process.env.ETH_ALCHEMY_API_KEY || ''),
    pythAdapterAddress: '0x271AcA3E9b8Ed9F4F618875093bD75a7E1b3116C' as types.EvmAddress,
  },
  ethereum_qa: {
    RPC_URL: process.env.ETH_RPC_URL,
    addressManager: '0xD40a37ADc14f73579A073DF353a2f6118CF313F4' as types.EvmAddress,
    treasuryAddress: '0x13159257aE85276f30A7b3DD8f2fC724913265e0' as types.EvmAddress,
    usdcAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' as types.EvmAddress,
    stEth: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84' as types.EvmAddress,
    gasStation: new EthereumAlchemyGasStation(process.env.ETH_ALCHEMY_API_KEY || ''),
    pythAdapterAddress: '0x3d5d2745db503C3B40dB49AD1023ad9ae7379979' as types.EvmAddress,
  },
  arbitrum: {
    RPC_URL: process.env.ARBITRUM_RPC_URL,
    addressManager: '0x25b7A20B8E9B0676E596eDF4329d38459c3f9a87' as types.EvmAddress,
    treasuryAddress: '0x475C4AF369B28997B25bd756eF92797AD3F69593' as types.EvmAddress,
    usdcAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as types.EvmAddress,
    stEth: '' as types.EvmAddress,
    gasStation: new GasStation(),
    pythAdapterAddress: '0x939D97719dd97930d8D4C3b899e091CC7458E0Df' as types.EvmAddress,
  },
};

const CURRENT_NETWORK: Network = Network.arbitrum;

function loadSettings(network: Network) {
  const config = CONFIGS[network];
  const provider = new ethers.providers.JsonRpcProvider(config.RPC_URL);
  const userSigner = new ethers.Wallet(ADMIN_ACCOUNTS.programAdminPk, provider);

  const sdk = new CegaEvmSDKV2(
    config.addressManager,
    config.treasuryAddress,
    config.gasStation,
    provider,
    userSigner,
  );
  return { sdk };
}

async function addDeposits(network: Network) {
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

async function depositUsingESTGasLimit() {
  const { sdk } = loadSettings(CURRENT_NETWORK);

  const amount = ethers.utils.parseUnits('0.0004', 18);
  const txResponse = await sdk.addToDepositQueue(
    67,
    amount,
    '0x0000000000000000000000000000000000000000',
  );
  console.log('TxResponse:', txResponse);
}

async function bulkActions(network: Network) {
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
  await sdk.bulkOpenVaultDeposits([]);
}

async function getQueues(network: Network) {
  const { sdk } = loadSettings(network);

  const productId = await sdk.getLatestProductId();
  // Get deposit queue
  for (let i = 1; i <= productId; i += 1) {
    // // eslint-disable-next-line no-await-in-loop
    // const depositQueue = await sdk.getDepositQueue(i);
    // console.log('deposit queue for product: ', i, ', Deposit Queue: ', depositQueue);
  }

  // Get withdrawal queue
  const vaultsToCheck: Record<string, EvmAddress[]> = {
    ethereum: [
      // Ethereum ETH dragon vault
      '0x5271d7425748a35455d1106c146a3e7f9dd4555a',
      // Ethereum USDC dragon vault
      '0x6754b1db1a4cb7e28e757290d24ba1181cbcd2ba',
      // Ethereum USDC dragon vault
      '0x3a3123E67aF60D97FD0050d1D20A0183C5190541',
    ],
    arbitrum: [],
  };
  for (const vaultAddress of vaultsToCheck[network]) {
    // eslint-disable-next-line no-await-in-loop
    const withdrawalQueue = await sdk.getWithdrawalQueue(vaultAddress);
    console.log('Withdrawal queue: ', vaultAddress, ':', withdrawalQueue);
  }
}

async function getProducts(network: Network, filename: string) {
  const { sdk } = loadSettings(network);

  const latestProductId = await sdk.getLatestProductId();
  const products = [];
  for (let productId = 1; productId <= latestProductId; productId += 1) {
    // console.log(`Product: ${productId}`);
    process.stdout.write('.');
    const productMetadata = await sdk.getProductMetadata(productId);
    const strategy = await sdk.getStrategyOfProduct(productId);
    let strategyStr;
    let productInfo;
    if (strategy === 1) {
      // DCS
      strategyStr = 'DCS';
      productInfo = await sdk.dcsGetProduct(productId);
    } else if (strategy === 2) {
      // FCN
      strategyStr = 'FCNv2';
      productInfo = await sdk.fcnGetProduct(productId);
    } else {
      throw new Error(`Invalid Strategy for Product: ${productId}`);
    }
    const product = {
      name: productMetadata.name,
      tradeWinnerNftImage: productMetadata.tradeWinnerNftImage,
      strategy: strategyStr,
      maxUnderlyingAmountLimit: productInfo.maxUnderlyingAmountLimit,
      minDepositAmount: productInfo.minDepositAmount,
      minWithdrawalAmount: productInfo.minWithdrawalAmount,
      daysToStartLateFees: productInfo.daysToStartLateFees,
      daysToStartAuctionDefault: productInfo.daysToStartAuctionDefault,
      daysToStartSettlementDefault: productInfo.daysToStartSettlementDefault,
      lateFeeBps: productInfo.lateFeeBps,
      strikeBarrierBps: productInfo.strikeBarrierBps,
      tenorInSeconds: productInfo.tenorInSeconds,
      disputePeriodInHours: productInfo.disputePeriodInHours,
      disputeGraceDelayInHours: productInfo.disputeGraceDelayInHours,
      isDepositQueueOpen: productInfo.isDepositQueueOpen,

      // DCS
      quoteAssetAddress: productInfo.quoteAssetAddress,
      baseAssetAddress: productInfo.baseAssetAddress,
      dcsOptionType: productInfo.dcsOptionType,

      // FCN:
      underlyingAsset: productInfo.underlyingAsset,
      leverage: productInfo.leverage,
      isBondOption: productInfo.isBondOption,
      observationIntervalInSeconds: productInfo.observationIntervalInSeconds,
      optionBarriers: productInfo.optionBarriers,
    };
    products.push(product);
  }

  const columns = Object.keys(products[0]);
  fs.writeFileSync(
    `${filename}.csv`,
    `${columns.join(',')}\n${products
      .map((product) => columns.map((column) => product[column as keyof typeof product]).join(','))
      .join('\n')}`,
  );
  return {
    columns,
    data: products,
  };
}

async function getVaults(network: Network, vaultAddresses: EvmAddress[]) {
  const { sdk } = loadSettings(network);

  for (const vaultAddress of vaultAddresses) {
    const vault = await sdk.getVault(vaultAddress);
    const couponPayment = await sdk.dcsGetCouponPayment(vaultAddress);
    console.log(
      `
        vaultAddress: ${vaultAddress},
        totalAssets: ${vault.totalAssets},
        couponPayment: ${couponPayment.toString()},
        auctionWinnerTokenId: ${vault.auctionWinnerTokenId},
        yieldFeeBps: ${vault.yieldFeeBps},
        managementFeeBps: ${vault.managementFeeBps},
        productId: ${vault.productId},
        auctionWinner: ${vault.auctionWinner},
        vaultStatus: ${vault.vaultStatus},
      `,
    );
  }
}

async function fillOrder() {
  const { sdk } = loadSettings(CURRENT_NETWORK);
  const order = {
    swapMakingAmount: BigNumber.from('500000000000000'),
    order: {
      salt: '888',
      makingAmount: '500000000000000',
      takingAmount: '396400000000000',
      maker: '' as EvmAddress, // add maker address
      makerAsset: '' as EvmAddress, // add maker asset
      takerAsset: '0x0000000000000000000000000000000000000000' as EvmAddress,
      expiry: '1726942743',
      makerTraits: '0',
    },
    makerSig: '', // add signature
  };
  const txResponse = await sdk.fillOrder(order);
  console.log('TxResponse:', txResponse);
  txResponse.wait();
  console.log('Order Filled', order);
  console.log('TxHash:', txResponse);
}

async function main() {
  // const { columns: productColumns, data: productData } = await getProducts(
  //   Network.ethereum,
  //   'ethereum-products',
  // );
  // const { columns: productColumns, data: productData } = await getProducts(
  //   Network.arbitrum,
  //   'arbitrum-products',
  // );
  // await getQueues(Network.ethereum);
  // await addDeposits(CURRENT_NETWORK);
  // await bulkActions(CURRENT_NETWORK);
  // await depositUsingESTGasLimit();
  // await fillOrder();
}

main();

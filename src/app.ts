/* eslint-disable no-await-in-loop */

// eslint-disable-next-line import/no-extraneous-dependencies
import * as dotenv from 'dotenv';

import { ethers } from 'ethers';
import {
  CegaEvmSDK,
  EthereumAlchemyGasStation,
  ArbitrumAlchemyGasStation,
  PolygonGasStation,
  types,
} from '.';

dotenv.config();

const CURRENT_NETWORK = 'arbitrum';

const config = {
  ethereum: {
    RPC_URL: process.env.ETH_RPC_URL,
    cegaStateAddress: '0x0730AA138062D8Cc54510aa939b533ba7c30f26B' as types.EvmAddress,
    usdcAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as types.EvmAddress,
    gasStation: new EthereumAlchemyGasStation(process.env.ETH_ALCHEMY_API_KEY || ''),
  },
  arbitrum: {
    RPC_URL: process.env.ARBITRUM_RPC_URL,
    cegaStateAddress: '0x4a2ecDe314080D37d4654cf0eb7DBe6d1BC89211' as types.EvmAddress,
    usdcAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as types.EvmAddress, // native USDC
    gasStation: new ArbitrumAlchemyGasStation(process.env.ARBITRUM_ALCHEMY_API_KEY || ''),
  },
};

const { cegaStateAddress, RPC_URL, usdcAddress, gasStation } = config[CURRENT_NETWORK];

const ADMIN_ACCOUNTS = {
  programAdminPk: process.env.PROGRAM_ADMIN_PK || '',
  operatorAdminPk: process.env.OPERATOR_ADMIN_PK || '',
  traderAdminPk: process.env.TRADER_ADMIN_PK || '',
  serviceAdminPk: process.env.SERVICE_ADMIN_PK || '',
};

async function execAsyncWithMetric(metricName: string, fn: () => Promise<any>): Promise<any> {
  const startTime = Date.now();
  const x = await fn();
  console.log(`[${metricName}]: ${Date.now() - startTime}`);
  return x;
}

async function run() {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const programAdminSigner = new ethers.Wallet(ADMIN_ACCOUNTS.programAdminPk, provider);
  const operatorAdminSigner = new ethers.Wallet(ADMIN_ACCOUNTS.operatorAdminPk, provider);
  const traderAdminSigner = new ethers.Wallet(ADMIN_ACCOUNTS.traderAdminPk, provider);
  const serviceAdminSigner = new ethers.Wallet(ADMIN_ACCOUNTS.serviceAdminPk, provider);

  const programSdk = new CegaEvmSDK(cegaStateAddress, gasStation, provider, programAdminSigner);
  const operatorSdk = new CegaEvmSDK(cegaStateAddress, gasStation, provider, operatorAdminSigner);
  const traderSdk = new CegaEvmSDK(cegaStateAddress, gasStation, provider, traderAdminSigner);
  const serviceSdk = new CegaEvmSDK(cegaStateAddress, gasStation, provider, serviceAdminSigner);
  console.log(`
  *** CegaState: ${cegaStateAddress},
    programAdmin: ${programAdminSigner.address},
    operatorAdmin: ${operatorAdminSigner.address},
    traderAdmin: ${traderAdminSigner.address},
    serviceAdmin: ${serviceAdminSigner.address},
    RPC URL: ${RPC_URL}
  `);

  const lovLeverages = [1, 2, 3, 4, 5];

  const productNames = await programSdk.getProductNames();
  const allProductAddresses = await programSdk.getAllProductAddresses(productNames);
  console.log('*******allProductAddresses: ', allProductAddresses);
  const allProductInfos = await programSdk.getAllProductInfos(productNames);
  console.log('***********allProductInfos: ', allProductInfos);

  // Set up args
  const lovProductNames = productNames.filter((productName) => productName.endsWith('-lov'));
  const fcnProductNames = productNames.filter((productName) => !productName.endsWith('-lov'));
  const lovProductNamesWithLeverage = lovProductNames
    .map((productName) => lovLeverages.map((leverage) => ({ productName, leverage })))
    .flat();
  const fcnProductNamesWithLeverage = fcnProductNames.map((productName) => ({ productName }));

  const allProductLeverageInfosFcn = await programSdk.getAllProductLeverageInfoFcn(
    fcnProductNamesWithLeverage,
  );
  console.log('***********allProductLeverageInfosFcn: ', allProductLeverageInfosFcn);

  const allProductLeverageInfosLov = await programSdk.getAllProductLeverageInfoLov(
    lovProductNamesWithLeverage,
  );
  console.log('***********allProductLeverageInfosLov: ', allProductLeverageInfosLov);

  const allVaultMetadataFcn = await programSdk.getAllVaultMetadataFcn(fcnProductNamesWithLeverage);
  console.log('******allVaultMetadata [across FCN products]: ', allVaultMetadataFcn);

  const allVaultMetadataLov = await programSdk.getAllVaultMetadataLov(lovProductNamesWithLeverage);
  console.log('******allVaultMetadata [across LOV products]: ', allVaultMetadataLov);

  const allVaultMetadata = {
    ...allVaultMetadataFcn,
    ...allVaultMetadataLov,
  };

  for (const productName of fcnProductNames) {
    const productAddress = await programSdk.getProductAddress(productName);
    const managementFeeBps = await programSdk.getManagementFeeBps(productName);
    console.log('*****fees: ', managementFeeBps);

    const vaultAddresses = await programSdk.getVaultAddressesFcn(productName);
    const vaultAssetInfo = await programSdk.getVaultAssetInfo(vaultAddresses);
    console.log('****vaultAssetInfo: ', vaultAssetInfo);

    console.log('fcnProductNames: productName: ', productName);
    const depositQueue = await programSdk.getDepositQueue(productName);
    console.log('****depositQueue: ', depositQueue);

    const userQueuedDepositsSum = await programSdk.getUserQueuedDepositsSumFcn(productName);
    console.log('***userQueuedDepositsSum: ', userQueuedDepositsSum);

    for (const vaultAddress of vaultAddresses) {
      const vaultMetadata = allVaultMetadata[vaultAddress];
      const withdrawalQueue = await programSdk.getWithdrawalQueue(productName, vaultAddress);
      console.log('****withdrawalQueue: ', withdrawalQueue);
      console.log(`
        productName: ${productName},
        productAddress: ${productAddress},
        vaultAddress: ${vaultAddress},
        vaultMetadata: ${vaultMetadata},
      `);
    }
  }

  for (const productName of lovProductNames) {
    const productAddress = await programSdk.getProductAddress(productName);
    const managementFeeBps = await programSdk.getManagementFeeBps(productName);
    console.log('*****fees: ', managementFeeBps);

    // TODO: implement fetch deposit queue for LOVs
    // const depositQueue = await programSdk.getDepositQueue(productName);
    // console.log('****depositQueue: ', depositQueue);

    for (const leverage of lovLeverages) {
      const vaultAddresses = await programSdk.getVaultAddressesLov(productName, leverage);
      const vaultAssetInfo = await programSdk.getVaultAssetInfo(vaultAddresses);
      console.log('****vaultAssetInfo: ', vaultAssetInfo);

      const userQueuedDepositsSum = await programSdk.getUserQueuedDepositsSumLov(
        productName,
        leverage,
      );
      console.log('***userQueuedDepositsSum: ', userQueuedDepositsSum);

      for (const vaultAddress of vaultAddresses) {
        const vaultMetadata = allVaultMetadata[vaultAddress];
        const withdrawalQueue = await programSdk.getWithdrawalQueue(productName, vaultAddress);
        console.log('****withdrawalQueue: ', withdrawalQueue);
        console.log(`
          productName: ${productName},
          productAddress: ${productAddress},
          vaultAddress: ${vaultAddress},
          vaultMetadata: ${vaultMetadata},
        `);
      }
    }
  }

  const isNotAllowed = await operatorSdk.getMarketMakerPermission(
    traderAdminSigner.address as types.EvmAddress,
  );
  console.log('Check MM permissions: ', isNotAllowed);

  const oracleNames = await serviceSdk.getOracleNames();
  console.log('Oracle Names: ', oracleNames, oracleNames.length);
  for (const oracleName of oracleNames) {
    const oracleAddress: string = await serviceSdk.getOracleAddress(oracleName);
    const oracleDescription: string = await serviceSdk.getOracleDescription(oracleName);
    console.log(
      `Name: ${oracleName}, Address: ${oracleAddress}. Description: ${oracleDescription}`,
    );
    const latestRoundData = await serviceSdk.latestRoundData(oracleName);
    console.log('latestRoundData: ', latestRoundData);
  }
}

async function main() {
  await run();
}

main();

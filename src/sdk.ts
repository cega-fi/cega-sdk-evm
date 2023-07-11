import { ethers } from 'ethers';

import { Multicall, ContractCallResults, ContractCallContext } from 'ethereum-multicall';

import {
  FCNVaultMetadata,
  OptionBarrier,
  OracleRoundData,
  OracleRoundDataResp,
  VaultStatus,
  SDKCache,
  ProductInfo,
  ProductAddressByName,
  Deposit,
  Withdrawal,
  FCNVaultAssetInfo,
  EvmAddress,
  TxOverrides,
  VaultAssetInfo,
  ProductLeverageInfo,
  ProductNameLeverageTuple,
  EvmContractType,
} from './types';

import {
  getEvmContractType,
  productNameLeverageTuple,
  splitArrayIntoChunks,
  splitProductNameLeverageTuple,
} from './utils';

import { GasStation } from './GasStation';

import CegaStateAbi from './abi/CegaState.json';
import Erc20Abi from './abi/ERC20.json';
import OracleAbi from './abi/Oracle.json';
import LOVProductAbi from './abi/LOVProduct.json';
import FCNProductAbi from './abi/FCNProduct.json';
import FCNVaultAbi from './abi/FCNVault.json';
import CegaViewerAbi from './abi/viewers/CegaViewer.json';

const defaultCache: SDKCache = {
  productAddressByName: {},
  vaultAddressesByProductNameLeverageTuple: {},
};

function multicallProcessReturnContext(r: any) {
  const val = r.returnValues[0];
  let returnVal;
  if (val === undefined) {
    returnVal = undefined;
  } else if (r.reference.endsWith('FCNVaultMetadataStruct-Array')) {
    returnVal = r.returnValues.map(
      (structArray: any[]) =>
        ({
          vaultStart: new Date(ethers.BigNumber.from(structArray[0]).toNumber() * 1000),
          tradeDate:
            ethers.BigNumber.from(structArray[1]).toNumber() !== 0
              ? new Date(ethers.BigNumber.from(structArray[1]).toNumber() * 1000)
              : null,
          tradeExpiry:
            ethers.BigNumber.from(structArray[2]).toNumber() !== 0
              ? new Date(ethers.BigNumber.from(structArray[2]).toNumber() * 1000)
              : null,
          aprBps: ethers.BigNumber.from(structArray[3]).toNumber(),
          tenorInDays: ethers.BigNumber.from(structArray[4]).toNumber(),
          underlyingAmount: ethers.BigNumber.from(structArray[5]),
          currentAssetAmount: ethers.BigNumber.from(structArray[6]),
          totalCouponPayoff: ethers.BigNumber.from(structArray[7]),
          vaultFinalPayoff: ethers.BigNumber.from(structArray[8]),
          queuedWithdrawalsSharesAmount: ethers.BigNumber.from(structArray[9]),
          queuedWithdrawalsCount: ethers.BigNumber.from(structArray[10]).toNumber(),
          optionBarriersCount: ethers.BigNumber.from(structArray[11]).toNumber(),
          leverage: ethers.BigNumber.from(structArray[12]).toNumber(),
          vaultAddress: structArray[13],
          vaultStatus: structArray[14],
          isKnockedIn: structArray[15],
          optionBarriers: (structArray[16] || []).map(
            (optionBarrierStructArray: any[]) =>
              ({
                barrierBps: ethers.BigNumber.from(optionBarrierStructArray[0]).toNumber(),
                barrierAbsoluteValue: ethers.BigNumber.from(optionBarrierStructArray[1]),
                strikeBps: ethers.BigNumber.from(optionBarrierStructArray[2]).toNumber(),
                strikeAbsoluteValue: ethers.BigNumber.from(optionBarrierStructArray[3]),
                asset: optionBarrierStructArray[4],
                oracleName: optionBarrierStructArray[5],
                barrierType: optionBarrierStructArray[6],
              } as OptionBarrier),
          ),
        } as FCNVaultMetadata),
    );
  } else if (r.reference === 'leverageMetadata-Struct') {
    returnVal = {
      isAllowed: r.returnValues[0],
      isDepositQueueOpen: r.returnValues[1],
      maxDepositAmountLimit: r.returnValues[2],
      sumVaultUnderlyingAmounts: r.returnValues[3],
      queuedDepositsTotalAmount: r.returnValues[4],
    };
  } else if (r.reference.endsWith('Array')) {
    returnVal = r.returnValues || []; // default to empty array if undefined
  } else if (r.reference.endsWith('boolean')) {
    returnVal = val;
  } else if (r.reference.endsWith('string')) {
    returnVal = val;
  } else if (r.reference.endsWith('number')) {
    returnVal = ethers.BigNumber.from(val).toNumber();
  } else {
    returnVal = val;
  }
  return returnVal;
}

export default class CegaEvmSDK {
  private _provider: ethers.providers.Provider;

  private _signer: ethers.Signer | undefined;

  private _gasStation: GasStation;

  private _cegaStateAddress: EvmAddress;

  private cache: SDKCache;

  constructor(
    cegaStateAddress: EvmAddress,
    gasStation: GasStation,
    provider: ethers.providers.Provider,
    signer: ethers.Signer | undefined = undefined,
  ) {
    this._provider = provider;
    this._signer = signer;

    this._gasStation = gasStation;

    this._cegaStateAddress = cegaStateAddress;

    this.cache = {
      ...defaultCache,
    };
  }

  setProvider(provider: ethers.providers.Provider) {
    this._provider = provider;
  }

  setSigner(signer: ethers.Signer) {
    this._signer = signer;
  }

  setCegaStateAddress(cegaStateAddress: EvmAddress) {
    this._cegaStateAddress = cegaStateAddress;
  }

  resetCache(): void {
    this.cache = {
      ...defaultCache,
    };
  }

  logCache(): SDKCache {
    console.log('[CACHE]', this.cache);
    return this.cache;
  }

  async loadCegaStateContract() {
    return new ethers.Contract(
      this._cegaStateAddress,
      CegaStateAbi.abi,
      this._signer || this._provider,
    );
  }

  async loadProductContract(productName: string): Promise<ethers.Contract> {
    const productAddress = await this.getProductAddress(productName);
    const contractAbi =
      getEvmContractType(productName) === EvmContractType.EvmLOVProduct
        ? LOVProductAbi.abi
        : FCNProductAbi.abi;
    return new ethers.Contract(productAddress, contractAbi, this._signer || this._provider);
  }

  async loadVaultContract(vaultAddress: EvmAddress): Promise<ethers.Contract> {
    return new ethers.Contract(vaultAddress, FCNVaultAbi.abi, this._signer || this._provider);
  }

  async loadOracleContract(oracleName: string): Promise<ethers.Contract> {
    const oracleAddress = await this.getOracleAddress(oracleName);
    return new ethers.Contract(oracleAddress, OracleAbi.abi, this._signer || this._provider);
  }

  async loadViewerContract(): Promise<ethers.Contract> {
    const cegaState = await this.loadCegaStateContract();
    const viewerAddress: EvmAddress = await cegaState.fcnProductViewerAddress();
    return new ethers.Contract(viewerAddress, CegaViewerAbi.abi, this._provider);
  }

  /**
   * Oracle Management
   */

  async getOracleNames(): Promise<string[]> {
    const cegaState = await this.loadCegaStateContract();
    return cegaState.getOracleNames();
  }

  async getOracleAddress(oracleName: string): Promise<EvmAddress> {
    const cegaState = await this.loadCegaStateContract();
    return cegaState.oracleAddresses(oracleName);
  }

  async getOracleDescription(oracleName: string): Promise<string> {
    const oracle = await this.loadOracleContract(oracleName);
    return oracle.description();
  }

  async getOracleDecimals(oracleName: string): Promise<string> {
    const oracle = await this.loadOracleContract(oracleName);
    return oracle.decimals();
  }

  async addOracle(
    oracleName: string,
    oracleAddress: EvmAddress,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaState = await this.loadCegaStateContract();
    return cegaState.addOracle(oracleName, oracleAddress, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async removeOracle(
    oracleName: string,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaState = await this.loadCegaStateContract();
    return cegaState.removeOracle(oracleName, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async addNextRoundData(
    oracleName: string,
    nextRoundData: OracleRoundData,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const oracle = await this.loadOracleContract(oracleName);

    return oracle.addNextRoundData(nextRoundData, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async updateRoundData(
    oracleName: string,
    roundId: number,
    roundData: OracleRoundData,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const oracle = await this.loadOracleContract(oracleName);
    return oracle.updateRoundData(roundId, roundData, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async getRoundData(oracleName: string, roundId: number): Promise<OracleRoundDataResp> {
    const oracle = await this.loadOracleContract(oracleName);
    const roundData = await oracle.getRoundData(roundId);
    return {
      roundId: ethers.BigNumber.from(roundData.roundId).toNumber(),
      answer: ethers.BigNumber.from(roundData.answer),
      startedAt: ethers.BigNumber.from(roundData.startedAt).toNumber(),
      updatedAt: ethers.BigNumber.from(roundData.updatedAt).toNumber(),
      answeredInRound: ethers.BigNumber.from(roundData.answeredInRound).toNumber(),
    };
  }

  async latestRoundData(oracleName: string): Promise<OracleRoundDataResp> {
    const oracle = await this.loadOracleContract(oracleName);
    const roundData = await oracle.latestRoundData();
    return {
      roundId: ethers.BigNumber.from(roundData.roundId).toNumber(),
      answer: ethers.BigNumber.from(roundData.answer),
      startedAt: ethers.BigNumber.from(roundData.startedAt).toNumber(),
      updatedAt: ethers.BigNumber.from(roundData.updatedAt).toNumber(),
      answeredInRound: ethers.BigNumber.from(roundData.answeredInRound).toNumber(),
    };
  }

  /**
   * Cega state management
   */

  async updateMarketMakerPermission(
    marketMakerAddress: EvmAddress,
    allow: boolean,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaState = await this.loadCegaStateContract();
    return cegaState.updateMarketMakerPermission(marketMakerAddress, allow, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async getMarketMakerPermission(marketMakerAddress: EvmAddress): Promise<boolean> {
    const cegaState = await this.loadCegaStateContract();
    return cegaState.marketMakerAllowList(marketMakerAddress);
  }

  async getFeeRecipient(): Promise<EvmAddress> {
    const cegaState = await this.loadCegaStateContract();
    return cegaState.feeRecipient();
  }

  async setFeeRecipient(
    feeRecipient: EvmAddress,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaState = await this.loadCegaStateContract();
    return cegaState.setFeeRecipient(feeRecipient, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async moveAssetsToProduct(
    productName: string,
    vaultAddress: EvmAddress,
    amount: ethers.BigNumber,
    overrides: TxOverrides = {},
  ) {
    const cegaState = await this.loadCegaStateContract();
    return cegaState.moveAssetsToProduct(productName, vaultAddress, amount, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  /**
   * Product Management
   */

  async addProduct(
    productName: string,
    productAddress: EvmAddress,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaState = await this.loadCegaStateContract();
    return cegaState.addProduct(productName, productAddress, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async removeProduct(
    productName: string,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const cegaState = await this.loadCegaStateContract();
    return cegaState.removeProduct(productName, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async getProductNames(): Promise<string[]> {
    const cegaState = await this.loadCegaStateContract();
    return cegaState.getProductNames();
  }

  async getProductAddress(productName: string, refreshCache = false): Promise<EvmAddress> {
    const cegaState = await this.loadCegaStateContract();
    const productAddress = this.cache.productAddressByName[productName];
    if (refreshCache || !productAddress) {
      this.cache.productAddressByName[productName] = await cegaState.products(productName);
    }
    return this.cache.productAddressByName[productName];
  }

  async getAllProductAddresses(productNames: string[]): Promise<ProductAddressByName> {
    const cegaState = await this.loadCegaStateContract();
    // need a special delimiter in reference otherwise product name may have the delimiter in the
    // name
    const specialDelimiter = '-delim-';

    if (
      productNames
        .map((productName) => this.cache.productAddressByName[productName])
        .every((productAddress) => productAddress !== undefined)
    ) {
      return productNames
        .map((productName) => ({ [productName]: this.cache.productAddressByName[productName] }))
        .reduce((acc, curr) => ({ ...acc, ...curr }), {});
    }

    const multicall = new Multicall({ ethersProvider: this._provider, tryAggregate: true });

    const contractCallContext: ContractCallContext[] = [
      {
        reference: 'productAddresses',
        contractAddress: cegaState.address,
        abi: CegaStateAbi.abi,
        calls: productNames.map((productName) => ({
          reference: `${productName}${specialDelimiter}string`,
          methodName: 'products',
          methodParameters: [productName],
        })),
      },
    ];

    const { results }: ContractCallResults = await multicall.call(contractCallContext);
    const allProductAddresses = results.productAddresses.callsReturnContext.reduce((a, b) => {
      const [productName, returnType] = b.reference.split(specialDelimiter);
      return {
        ...a,
        [productName]: multicallProcessReturnContext(b),
      };
    }, {});
    this.cache.productAddressByName = {
      ...this.cache.productAddressByName,
      ...allProductAddresses,
    };
    return allProductAddresses;
  }

  async getAllProductInfos(
    productNames: string[],
  ): Promise<{ [productName: string]: ProductInfo }> {
    if (productNames.length === 0) {
      return {};
    }
    const productAddressesByName = await this.getAllProductAddresses(productNames);

    const multicall = new Multicall({ ethersProvider: this._provider, tryAggregate: true });
    const contractCallContext: ContractCallContext[] = Object.entries(productAddressesByName).map(
      ([productName, productAddress]) => ({
        reference: productName,
        contractAddress: productAddress,
        abi: FCNProductAbi.abi, // NOTE: these calls work for both FCNProduct & LOVProduct
        calls: [
          {
            reference: 'asset-string',
            methodName: 'asset',
            methodParameters: [],
          },
          {
            reference: 'name-string',
            methodName: 'name',
            methodParameters: [],
          },
          {
            reference: 'managementFeeBps-number',
            methodName: 'managementFeeBps',
            methodParameters: [],
          },
          {
            reference: 'yieldFeeBps-number',
            methodName: 'yieldFeeBps',
            methodParameters: [],
          },
          {
            reference: 'minDepositAmount-BigNumber',
            methodName: 'minDepositAmount',
            methodParameters: [],
          },
          {
            reference: 'minWithdrawalAmount-BigNumber',
            methodName: 'minWithdrawalAmount',
            methodParameters: [],
          },
        ],
      }),
    );

    const { results }: ContractCallResults = await multicall.call(contractCallContext);
    const productInfoByProductName = Object.entries(results)
      .map(([productName, { callsReturnContext }]) => ({
        [productName]: {
          ...callsReturnContext
            .map((r) => ({ [r.methodName]: multicallProcessReturnContext(r) }))
            .reduce((a, b) => ({ ...a, ...b }), {
              address: productAddressesByName[productName],
              contractType: getEvmContractType(productName),
            }),
        } as ProductInfo,
      }))
      .reduce((a, b) => ({ ...a, ...b }), {});

    return productInfoByProductName;
  }

  async getAllProductLeverageInfoFcn(
    // NOTE: the leverage attribute is ignored as FCN Leverage = 1. Keep same interface as LOV
    productNamesWithLeverage: { productName: string; leverage?: number }[],
  ): Promise<{ [productNameLeverage: ProductNameLeverageTuple]: ProductLeverageInfo }> {
    if (productNamesWithLeverage.length === 0) {
      return {};
    }
    const productNames = [...new Set(productNamesWithLeverage.map((pwl) => pwl.productName))];
    const productAddressesByName = await this.getAllProductAddresses(productNames);

    const multicall = new Multicall({ ethersProvider: this._provider, tryAggregate: true });
    const contractCallContext: ContractCallContext[] = productNamesWithLeverage.map(
      ({ productName, leverage }) => ({
        reference: productNameLeverageTuple(productName, 1),
        contractAddress: productAddressesByName[productName],
        abi: FCNProductAbi.abi,
        calls: [
          {
            reference: 'name-string',
            methodName: 'name',
            methodParameters: [],
          },
          {
            reference: 'isDepositQueueOpen-boolean',
            methodName: 'isDepositQueueOpen',
            methodParameters: [],
          },
          {
            reference: 'maxDepositAmountLimit-BigNumber',
            methodName: 'maxDepositAmountLimit',
            methodParameters: [],
          },
          {
            reference: 'sumVaultUnderlyingAmounts-BigNumber',
            methodName: 'sumVaultUnderlyingAmounts',
            methodParameters: [],
          },
          {
            reference: 'queuedDepositsTotalAmount-BigNumber',
            methodName: 'queuedDepositsTotalAmount',
            methodParameters: [],
          },
          {
            reference: 'queuedDepositsCount-number',
            methodName: 'queuedDepositsCount',
            methodParameters: [],
          },
          {
            reference: 'getVaultAddressesCall-Array',
            methodName: 'getVaultAddresses',
            methodParameters: [],
          },
        ],
      }),
    );

    const { results }: ContractCallResults = await multicall.call(contractCallContext);
    const productLeverageInfoByProductNameLeverage: {
      [pnLTuple: ProductNameLeverageTuple]: ProductLeverageInfo;
    } = Object.entries(results)
      .map(([pnLTuple, { callsReturnContext }]) => ({
        [pnLTuple as ProductNameLeverageTuple]: {
          ...callsReturnContext
            .map((r) => ({ [r.methodName]: multicallProcessReturnContext(r) }))
            .reduce((a, b) => ({ ...a, ...b }), { leverage: 1 }),
        } as ProductLeverageInfo,
      }))
      .reduce((a, b) => ({ ...a, ...b }), {});

    for (const [pnLTuple, productLeverageInfo] of Object.entries(
      productLeverageInfoByProductNameLeverage,
    ) as [ProductNameLeverageTuple, ProductLeverageInfo][]) {
      this.cache.vaultAddressesByProductNameLeverageTuple[pnLTuple] =
        productLeverageInfo.getVaultAddresses;
    }

    return productLeverageInfoByProductNameLeverage;
  }

  async getAllProductLeverageInfoLov(
    productNamesWithLeverage: { productName: string; leverage: number }[],
  ): Promise<{ [productNameLeverage: ProductNameLeverageTuple]: ProductLeverageInfo }> {
    if (productNamesWithLeverage.length === 0) {
      return {};
    }
    const productNames = [...new Set(productNamesWithLeverage.map((pwl) => pwl.productName))];
    const productAddressesByName = await this.getAllProductAddresses(productNames);

    const product = this.loadProductContract(productNamesWithLeverage[0].productName);

    const multicall = new Multicall({ ethersProvider: this._provider, tryAggregate: true });
    const contractCallContext: ContractCallContext[] = productNamesWithLeverage.map(
      ({ productName, leverage }) => ({
        reference: productNameLeverageTuple(productName, leverage),
        contractAddress: productAddressesByName[productName],
        abi: LOVProductAbi.abi,
        calls: [
          {
            reference: 'name-string',
            methodName: 'name',
            methodParameters: [],
          },
          {
            reference: 'queuedDepositsCount-number',
            methodName: 'getDepositQueueCount',
            methodParameters: [leverage],
          },
          {
            reference: 'leverageMetadata-Struct',
            methodName: 'leverages',
            methodParameters: [leverage],
          },
          {
            reference: 'getVaultAddressesCall-Array',
            methodName: 'getVaultAddresses',
            methodParameters: [leverage],
          },
        ],
      }),
    );

    const { results }: ContractCallResults = await multicall.call(contractCallContext);
    const productLeverageInfoByProductNameLeverage: {
      [pnLTuple: ProductNameLeverageTuple]: ProductLeverageInfo;
    } = Object.entries(results)
      .map(([pnLTuple, { callsReturnContext }]) => {
        const leverageMetadata = multicallProcessReturnContext(callsReturnContext[2]);
        return {
          [pnLTuple as ProductNameLeverageTuple]: {
            name: multicallProcessReturnContext(callsReturnContext[0]),
            leverage: splitProductNameLeverageTuple(pnLTuple as ProductNameLeverageTuple)[1],
            queuedDepositsCount: multicallProcessReturnContext(callsReturnContext[1]),
            isDepositQueueOpen: leverageMetadata.isDepositQueueOpen,
            maxDepositAmountLimit: leverageMetadata.maxDepositAmountLimit,
            sumVaultUnderlyingAmounts: leverageMetadata.sumVaultUnderlyingAmounts,
            queuedDepositsTotalAmount: leverageMetadata.queuedDepositsTotalAmount,
            getVaultAddresses: multicallProcessReturnContext(callsReturnContext[3]),
          } as ProductLeverageInfo,
        };
      })
      .reduce((a, b) => ({ ...a, ...b }), {});

    return productLeverageInfoByProductNameLeverage;
  }

  async getVaultAddressesFcn(
    productName: string,
    leverage = 1, // Unused
    refreshCache = false,
  ): Promise<EvmAddress[]> {
    const product = await this.loadProductContract(productName);
    const pnLTuple = productNameLeverageTuple(productName, 1);
    const vaultAddresses = this.cache.vaultAddressesByProductNameLeverageTuple[pnLTuple];
    if (refreshCache || !vaultAddresses || vaultAddresses.length === 0) {
      this.cache.vaultAddressesByProductNameLeverageTuple[pnLTuple] =
        await product.getVaultAddresses();
    }
    return this.cache.vaultAddressesByProductNameLeverageTuple[pnLTuple];
  }

  async getVaultAddressesLov(
    productName: string,
    leverage: number,
    refreshCache = false,
  ): Promise<EvmAddress[]> {
    const product = await this.loadProductContract(productName);
    const pnLTuple = productNameLeverageTuple(productName, leverage);
    const vaultAddresses = this.cache.vaultAddressesByProductNameLeverageTuple[pnLTuple];
    if (refreshCache || !vaultAddresses || vaultAddresses.length === 0) {
      this.cache.vaultAddressesByProductNameLeverageTuple[pnLTuple] =
        await product.getVaultAddresses(leverage);
    }
    return this.cache.vaultAddressesByProductNameLeverageTuple[pnLTuple];
  }

  async getProductAsset(productName: string): Promise<EvmAddress> {
    const product = await this.loadProductContract(productName);
    return product.asset();
  }

  async getAllVaultMetadataFcn(
    productNamesWithLeverage: { productName: string; leverage?: number }[],
  ): Promise<{ [vaultAddress: string]: FCNVaultMetadata }> {
    if (productNamesWithLeverage.length === 0) {
      return {};
    }
    const productNames = [...new Set(productNamesWithLeverage.map((pwl) => pwl.productName))];
    const nameTypeDelimiter = '/';
    const viewerContract = await this.loadViewerContract();
    const productAddressesByName = await this.getAllProductAddresses(productNames);

    const multicall = new Multicall({ ethersProvider: this._provider, tryAggregate: true });
    const contractCallContext: ContractCallContext[] = [
      {
        reference: 'vaultMetadataList',
        contractAddress: viewerContract.address,
        abi: CegaViewerAbi.abi,
        calls: productNamesWithLeverage.map(({ productName, leverage }) => ({
          reference: `${productNameLeverageTuple(
            productName,
            1, // Leverage must be 1 for FCN
          )}${nameTypeDelimiter}FCNVaultMetadataStruct-Array`,
          methodName: 'getFCNVaultMetadata',
          methodParameters: [productAddressesByName[productName]],
        })),
      },
    ];

    const { results }: ContractCallResults = await multicall.call(contractCallContext);

    // filter out multicalls that return an empty array of vaultMetadatas
    const metadatasByVaultAddress = results.vaultMetadataList.callsReturnContext
      .filter((x) => x.returnValues.length > 0)
      .map((x) => {
        // const productNameLeverageTuple = x.reference.split(nameTypeDelimiter)[0];
        const fcnVaultMetadataArray = multicallProcessReturnContext(x) as FCNVaultMetadata[];
        return fcnVaultMetadataArray.map((fcnVaultMetadata) => ({
          [fcnVaultMetadata.vaultAddress]: fcnVaultMetadata,
        }));
      })
      .flat()
      .reduce((acc, currentVal) => ({ ...acc, ...currentVal }), {});
    return metadatasByVaultAddress;
  }

  async getAllVaultMetadataLov(
    productNamesWithLeverage: { productName: string; leverage: number }[],
  ): Promise<{ [vaultAddress: string]: FCNVaultMetadata }> {
    if (productNamesWithLeverage.length === 0) {
      return {};
    }
    const productNames = [...new Set(productNamesWithLeverage.map((pwl) => pwl.productName))];
    const nameTypeDelimiter = '/';
    const viewerContract = await this.loadViewerContract();
    const productAddressesByName = await this.getAllProductAddresses(productNames);

    const multicall = new Multicall({ ethersProvider: this._provider, tryAggregate: true });
    const contractCallContext: ContractCallContext[] = [
      {
        reference: 'vaultMetadataList',
        contractAddress: viewerContract.address,
        abi: CegaViewerAbi.abi,
        calls: productNamesWithLeverage.map(({ productName, leverage }) => ({
          reference: `${productNameLeverageTuple(
            productName,
            leverage,
          )}${nameTypeDelimiter}FCNVaultMetadataStruct-Array`,
          methodName: 'getLOVVaultMetadata', // return type is still FCNVaultMetadata Struct []
          methodParameters: [productAddressesByName[productName], leverage],
        })),
      },
    ];

    const { results }: ContractCallResults = await multicall.call(contractCallContext);

    // filter out multicalls that return an empty array of vaultMetadatas
    const metadatasByVaultAddress = results.vaultMetadataList.callsReturnContext
      .filter((x) => x.returnValues.length > 0)
      .map((x) => {
        // const productNameLeverageTuple = x.reference.split(nameTypeDelimiter)[0];
        const fcnVaultMetadataArray = multicallProcessReturnContext(x) as FCNVaultMetadata[];
        return fcnVaultMetadataArray.map((fcnVaultMetadata) => ({
          [fcnVaultMetadata.vaultAddress]: fcnVaultMetadata,
        }));
      })
      .flat()
      .reduce((acc, currentVal) => ({ ...acc, ...currentVal }), {});
    return metadatasByVaultAddress;
  }

  async getVaultAssetInfo(
    vaultAddresses: EvmAddress[],
  ): Promise<{ [vaultAddress: EvmAddress]: VaultAssetInfo }> {
    if (vaultAddresses.length === 0) {
      return {};
    }
    const multicall = new Multicall({ ethersProvider: this._provider, tryAggregate: true });
    const contractCallContext: ContractCallContext[] = vaultAddresses.map((vaultAddress) => ({
      reference: vaultAddress,
      contractAddress: vaultAddress,
      abi: FCNVaultAbi.abi,
      calls: [
        {
          reference: 'tokenName-string',
          methodName: 'name',
          methodParameters: [],
        },
        {
          reference: 'tokenSymbol-string',
          methodName: 'symbol',
          methodParameters: [],
        },
        {
          reference: 'totalSupply-BigNumber',
          methodName: 'totalSupply',
          methodParameters: [],
        },
      ],
    }));

    const { results }: ContractCallResults = await multicall.call(contractCallContext);
    const vaultAssetInfoByVaultAddress = Object.entries(results)
      .map(([_vaultAddress, { callsReturnContext }]) => {
        const vaultAddress = _vaultAddress as EvmAddress;
        const tokenName: string = multicallProcessReturnContext(callsReturnContext[0]);
        const tokenSymbol: string = multicallProcessReturnContext(callsReturnContext[1]);
        const totalSupply: ethers.BigNumber = multicallProcessReturnContext(callsReturnContext[2]);
        return {
          [vaultAddress]: {
            vaultAddress,
            tokenName,
            tokenSymbol,
            totalSupply,
          },
        };
      })
      .reduce((a, b) => ({ ...a, ...b }), {});

    return vaultAssetInfoByVaultAddress;
  }

  async getFCNVaultAssetInfo(
    productName: string,
    inputAssets = 0,
    inputShares = 0,
  ): Promise<{ [vaultAddress: EvmAddress]: FCNVaultAssetInfo }> {
    const product = await this.loadProductContract(productName);
    const viewerContract = await this.loadViewerContract();
    const assetInfosByVaultAddress = (
      await viewerContract.getFCNVaultAssetInfo(product.address, inputAssets, inputShares)
    )
      .map(
        (assetInfoArray: any[]) =>
          ({
            vaultAddress: assetInfoArray[0] as EvmAddress,
            totalAssets: ethers.BigNumber.from(assetInfoArray[1]),
            totalSupply: ethers.BigNumber.from(assetInfoArray[2]),
            inputAssets: ethers.BigNumber.from(assetInfoArray[3]),
            outputShares: ethers.BigNumber.from(assetInfoArray[4]),
            inputShares: ethers.BigNumber.from(assetInfoArray[5]),
            outputAssets: ethers.BigNumber.from(assetInfoArray[6]),
          } as FCNVaultAssetInfo),
      )
      .reduce(
        (
          acc: { [vaultAddress: string]: FCNVaultAssetInfo },
          currentAssetInfo: FCNVaultAssetInfo,
        ) => ({
          ...acc,
          [currentAssetInfo.vaultAddress]: currentAssetInfo,
        }),
        {},
      );
    return assetInfosByVaultAddress;
  }

  async getUserQueuedDepositsSumFcn(
    productName: string,
    userAddress: EvmAddress | null = null,
  ): Promise<ethers.BigNumber> {
    if (!(userAddress || this._signer)) {
      throw new Error('No user present');
    }
    const userAddr = userAddress || (await this._signer?.getAddress());

    const viewerContract = await this.loadViewerContract();
    const productAddress = await this.getProductAddress(productName);
    return viewerContract.getFCNProductUserQueuedDeposits(productAddress, userAddr);
  }

  async getUserQueuedDepositsSumLov(
    productName: string,
    leverage: number,
    userAddress: EvmAddress | null = null,
  ): Promise<ethers.BigNumber> {
    if (!(userAddress || this._signer)) {
      throw new Error('No user present');
    }
    const userAddr = userAddress || (await this._signer?.getAddress());

    const viewerContract = await this.loadViewerContract();
    const productAddress = await this.getProductAddress(productName);
    return viewerContract.getLOVProductUserQueuedDeposits(productAddress, userAddr, leverage);
  }

  /**
   * Only works for FCN Product
   */
  async getDepositQueuePartial(productName: string, indices: number[]): Promise<Deposit[]> {
    const product = await this.loadProductContract(productName);

    const multicall = new Multicall({ ethersProvider: this._provider, tryAggregate: true });
    const contractCallContext: ContractCallContext[] = [
      {
        reference: 'partialDepositQueue',
        contractAddress: product.address,
        abi: FCNProductAbi.abi,
        calls: indices.map((index) => ({
          reference: `${productName}-DepositArray`,
          methodName: 'depositQueue',
          methodParameters: [index],
        })),
      },
    ];
    const { results }: ContractCallResults = await multicall.call(contractCallContext);
    const depositQueue: Deposit[] = results.partialDepositQueue.callsReturnContext.reduce(
      (a: Deposit[], b) => [
        ...a,
        {
          amount: ethers.BigNumber.from(b.returnValues[0]),
          receiver: b.returnValues[1],
        },
      ],
      [],
    );
    return depositQueue;
  }

  /**
   * Only works for FCN Product
   */
  async getDepositQueue(productName: string, chunkSize = 10): Promise<Deposit[]> {
    const product = await this.loadProductContract(productName);
    const depositQueueLength = ethers.BigNumber.from(
      await product.queuedDepositsCount(),
    ).toNumber();
    const indicesChunks = splitArrayIntoChunks<number>(
      [...Array(depositQueueLength).keys()],
      chunkSize,
    );
    const depositQueue = (
      await Promise.all(
        indicesChunks.map((indicesChunk) => this.getDepositQueuePartial(productName, indicesChunk)),
      )
    ).reduce((acc, depositQueueSubset) => [...acc, ...depositQueueSubset], []);
    return depositQueue;
  }

  /**
   * Only works for FCN Product
   */
  async getWithdrawalQueuePartial(
    productName: string,
    vaultAddress: EvmAddress,
    indices: number[],
  ): Promise<Withdrawal[]> {
    const product = await this.loadProductContract(productName);

    const multicall = new Multicall({ ethersProvider: this._provider, tryAggregate: true });
    const contractCallContext: ContractCallContext[] = [
      {
        reference: 'partialWithdrawalQueue',
        contractAddress: product.address,
        abi: FCNProductAbi.abi,
        calls: indices.map((index) => ({
          reference: `${productName}-WithdrawalArray`,
          methodName: 'withdrawalQueues',
          methodParameters: [vaultAddress, index],
        })),
      },
    ];
    const { results }: ContractCallResults = await multicall.call(contractCallContext);
    const withdrawalQueue: Withdrawal[] = results.partialWithdrawalQueue.callsReturnContext.reduce(
      (a: Withdrawal[], b) => [
        ...a,
        {
          amountShares: ethers.BigNumber.from(b.returnValues[0]),
          receiver: b.returnValues[1],
        },
      ],
      [],
    );
    return withdrawalQueue;
  }

  /**
   * Only works for FCN Product
   */
  async getWithdrawalQueue(
    productName: string,
    vaultAddress: EvmAddress,
    chunkSize = 10,
  ): Promise<Withdrawal[]> {
    const product = await this.loadProductContract(productName);
    const { queuedWithdrawalsCount } = await product.vaults(vaultAddress);
    const withdrawalQueueLength = ethers.BigNumber.from(queuedWithdrawalsCount).toNumber();
    const indicesChunks = splitArrayIntoChunks<number>(
      [...Array(withdrawalQueueLength).keys()],
      chunkSize,
    );
    const withdrawalQueue = (
      await Promise.all(
        indicesChunks.map((indicesChunk) =>
          this.getWithdrawalQueuePartial(productName, vaultAddress, indicesChunk),
        ),
      )
    ).reduce((acc, withdrawalQueueSubset) => [...acc, ...withdrawalQueueSubset], []);
    return withdrawalQueue;
  }

  async getManagementFeeBps(productName: string): Promise<number> {
    const product = await this.loadProductContract(productName);
    const managementFeeBps = await product.managementFeeBps();
    return managementFeeBps.toNumber();
  }

  async setManagementFeeBps(
    productName: string,
    managementFeeBps: number,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    return product.setManagementFeeBps(managementFeeBps, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async getYieldFeeBps(productName: string): Promise<number> {
    const product = await this.loadProductContract(productName);
    const yieldFeeBps = await product.yieldFeeBps();
    return yieldFeeBps.toNumber();
  }

  async setYieldFeeBps(
    productName: string,
    yieldFeeBps: number,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    return product.setYieldFeeBps(yieldFeeBps, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async getIsDepositQueueOpen(productName: string): Promise<boolean> {
    const product = await this.loadProductContract(productName);
    return product.isDepositQueueOpen();
  }

  async setIsDepositQueueOpenFcn(
    productName: string,
    isDepositQueueOpen: boolean,
    leverage = 1,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    return product.setIsDepositQueueOpen(isDepositQueueOpen, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async setIsDepositQueueOpenLov(
    productName: string,
    isDepositQueueOpen: boolean,
    leverage: number,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    return product.setIsDepositQueueOpen(leverage, isDepositQueueOpen, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async getMaxDepositAmountLimit(productName: string): Promise<ethers.BigNumber> {
    const product = await this.loadProductContract(productName);
    const maxDepositAmountLimit = await product.maxDepositAmountLimit();
    return maxDepositAmountLimit;
  }

  async setMaxDepositAmountLimitFcn(
    productName: string,
    maxDepositAmountLimit: ethers.BigNumber,
    leverage = 1, // Unused
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    return product.setMaxDepositAmountLimit(maxDepositAmountLimit, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async setMaxDepositAmountLimitLov(
    productName: string,
    maxDepositAmountLimit: ethers.BigNumber,
    leverage: number,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    return product.setMaxDepositAmountLimit(leverage, maxDepositAmountLimit, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async createVaultFcn(
    productName: string,
    tokenName: string,
    tokenSymbol: string,
    vaultStart: Date,
    leverage = 1, // Unused
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    const vaultStartInSeconds = Math.floor(vaultStart.getTime() / 1000);
    return product.createVault(tokenName, tokenSymbol, vaultStartInSeconds, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async createVaultLov(
    productName: string,
    tokenName: string,
    tokenSymbol: string,
    vaultStart: Date,
    leverage: number,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    const vaultStartInSeconds = Math.floor(vaultStart.getTime() / 1000);
    return product.createVault(tokenName, tokenSymbol, vaultStartInSeconds, leverage, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async removeVaultFcn(
    productName: string,
    vaultAddress: EvmAddress,
    leverage = 1, // Unused
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    const vaultAddresses = await this.getVaultAddressesFcn(productName);
    const vaultIndex = vaultAddresses.findIndex((vAddress) => vAddress === vaultAddress);
    if (vaultIndex === -1) {
      throw new Error('Vault address not found');
    }
    return product.removeVault(vaultIndex, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async removeVaultLov(
    productName: string,
    vaultAddress: EvmAddress,
    leverage: number,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    const vaultAddresses = await this.getVaultAddressesLov(productName, leverage);
    const vaultIndex = vaultAddresses.findIndex((vAddress) => vAddress === vaultAddress);
    if (vaultIndex === -1) {
      throw new Error('Vault address not found');
    }
    return product.removeVault(leverage, vaultIndex, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async setTradeData(
    productName: string,
    vaultAddress: EvmAddress,
    tradeDate: Date,
    tradeExpiry: Date,
    aprBps: number,
    tenorInDays: number,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    return product.setTradeData(
      vaultAddress,
      Math.floor(tradeDate.getTime() / 1000),
      Math.floor(tradeExpiry.getTime() / 1000),
      aprBps,
      tenorInDays,
      {
        ...(await this._gasStation.getGasOraclePrices()),
        ...overrides,
      },
    );
  }

  async addOptionBarrier(
    productName: string,
    vaultAddress: EvmAddress,
    optionBarrier: OptionBarrier,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    return product.addOptionBarrier(vaultAddress, optionBarrier, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async updateOptionBarrier(
    productName: string,
    vaultAddress: EvmAddress,
    index: number,
    asset: string,
    strikeAbsoluteValue: ethers.BigNumber,
    barrierAbsoluteValue: ethers.BigNumber,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    return product.updateOptionBarrier(
      vaultAddress,
      index,
      asset,
      strikeAbsoluteValue,
      barrierAbsoluteValue,
      {
        ...(await this._gasStation.getGasOraclePrices()),
        ...overrides,
      },
    );
  }

  async updateOptionBarrierOracle(
    productName: string,
    vaultAddress: EvmAddress,
    index: number,
    asset: string,
    newOracleName: string,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    return product.updateOptionBarrierOracle(vaultAddress, index, asset, newOracleName, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async removeOptionBarrier(
    productName: string,
    vaultAddress: EvmAddress,
    index: number,
    asset: string,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    return product.removeOptionBarrier(vaultAddress, index, asset, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async setVaultStatus(
    productName: string,
    vaultAddress: EvmAddress,
    vaultStatus: VaultStatus,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    return product.setVaultStatus(vaultAddress, vaultStatus, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async openVaultDeposits(
    productName: string,
    vaultAddress: EvmAddress,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    return product.openVaultDeposits(vaultAddress, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async setKnockInStatus(
    productName: string,
    vaultAddress: EvmAddress,
    newState: boolean,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    return product.setKnockInStatus(vaultAddress, newState, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async getAssetAllowanceToProduct(
    productName: string,
    ownerAddress: EvmAddress | null = null,
  ): Promise<ethers.BigNumber> {
    if (!(ownerAddress || this._signer)) {
      throw new Error('No owner present');
    }
    const ownerAddr = ownerAddress || (await this._signer?.getAddress());

    const product = await this.loadProductContract(productName);
    const asset: EvmAddress = await product.asset();
    const erc20Contract = new ethers.Contract(asset, Erc20Abi.abi, this._provider);
    return erc20Contract.allowance(ownerAddr, product.address);
  }

  async approveAssetToProduct(
    productName: string,
    amount: ethers.BigNumber,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    const asset: EvmAddress = await product.asset();
    const erc20Contract = new ethers.Contract(asset, Erc20Abi.abi, this._signer);
    return erc20Contract.approve(product.address, amount, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async increaseAssetAllowanceToProduct(
    productName: string,
    amount: ethers.BigNumber,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    // NOTE: not all ERC20 tokens have `increaseAllowance` function
    // https://ethereum.stackexchange.com/questions/122634/difference-between-approve-and-increaseallowance-in-erc20-contract
    const product = await this.loadProductContract(productName);
    const asset: EvmAddress = await product.asset();
    const erc20Contract = new ethers.Contract(asset, Erc20Abi.abi, this._signer);
    return erc20Contract.increaseAllowance(product.address, amount, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async addToDepositQueueFcn(
    productName: string,
    amount: ethers.BigNumber,
    leverage = 1, // Unused
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    return product.addToDepositQueue(amount, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async addToDepositQueueLov(
    productName: string,
    amount: ethers.BigNumber,
    leverage: number,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    return product.addToDepositQueue(leverage, amount, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async processDepositQueue(
    productName: string,
    vaultAddress: EvmAddress,
    maxProcessCount: number,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    return product.processDepositQueue(vaultAddress, maxProcessCount, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async getVaultTokenAllowanceToProduct(
    productName: string,
    vaultAddress: EvmAddress,
    ownerAddress: EvmAddress | null = null,
  ): Promise<ethers.BigNumber> {
    if (!(ownerAddress || this._signer)) {
      throw new Error('No owner present');
    }
    const ownerAddr = ownerAddress || (await this._signer?.getAddress());

    const product = await this.loadProductContract(productName);
    const vault = await this.loadVaultContract(vaultAddress);
    return vault.allowance(ownerAddr, product.address);
  }

  async approveVaultTokenToProduct(
    productName: string,
    vaultAddress: EvmAddress,
    amountShares: ethers.BigNumber,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    const vault = await this.loadVaultContract(vaultAddress);
    return vault.approve(product.address, amountShares, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async increaseVaultTokenAllowanceToProduct(
    productName: string,
    vaultAddress: EvmAddress,
    amountShares: ethers.BigNumber,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    // NOTE: not all ERC20 tokens have `increaseAllowance` function
    const product = await this.loadProductContract(productName);
    const vault = await this.loadVaultContract(vaultAddress);
    return vault.increaseAllowance(product.address, amountShares, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async addToWithdrawalQueue(
    productName: string,
    vaultAddress: EvmAddress,
    amountShares: ethers.BigNumber,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    return product.addToWithdrawalQueue(vaultAddress, amountShares, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async collectFees(
    productName: string,
    vaultAddress: EvmAddress,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    return product.collectFees(vaultAddress, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async processWithdrawalQueue(
    productName: string,
    vaultAddress: EvmAddress,
    maxProcessCount: number,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    return product.processWithdrawalQueue(vaultAddress, maxProcessCount, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async rolloverVault(
    productName: string,
    vaultAddress: EvmAddress,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    return product.rolloverVault(vaultAddress, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async sendAssetsToTrade(
    productName: string,
    vaultAddress: EvmAddress,
    receiver: string,
    amount: ethers.BigNumber,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    return product.sendAssetsToTrade(vaultAddress, receiver, amount, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  /**
   * Cega Scheduler Actions
   */
  async checkBarriers(
    productName: string,
    vaultAddress: EvmAddress,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    return product.checkBarriers(vaultAddress, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async calculateCurrentYield(
    productName: string,
    vaultAddress: EvmAddress,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    return product.calculateCurrentYield(vaultAddress, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }

  async calculateVaultFinalPayoff(
    productName: string,
    vaultAddress: EvmAddress,
    overrides: TxOverrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    const product = await this.loadProductContract(productName);
    return product.calculateVaultFinalPayoff(vaultAddress, {
      ...(await this._gasStation.getGasOraclePrices()),
      ...overrides,
    });
  }
}

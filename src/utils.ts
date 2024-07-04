import { ethers } from 'ethers';
import { ProductNameLeverageTuple, pnlTupleDelimiter, EvmContractType, TxOverrides } from './types';

export function splitArrayIntoChunks<Type>(inputArray: Type[], chunkSize: number): Type[][] {
  const result = [];
  for (let i = 0; i < inputArray.length; i += chunkSize) {
    result.push(inputArray.slice(i, i + chunkSize));
  }
  return result;
}

export function productNameLeverageTuple(
  productName: string,
  leverage: number,
): ProductNameLeverageTuple {
  return `${productName}${pnlTupleDelimiter}${leverage}`;
}

export function splitProductNameLeverageTuple(
  productNameLeverage: ProductNameLeverageTuple,
): [string, number] {
  const [productName, leverageStr] = productNameLeverage.split(pnlTupleDelimiter);
  return [productName, Number(leverageStr)];
}

export function getEvmContractType(productName: string): EvmContractType {
  if (productName.endsWith('-lov')) {
    return EvmContractType.EvmLOVProduct;
  }
  return EvmContractType.EvmFCNProduct;
}

/**
 * This function will estimate the gas limit for a transaction. If the gas estimation fails,
 * it will use the manual gas limit provided in the overrides.
 * And then it will return the overrides object with the estimated/ manual gas limit.
 * @returns {number} The estimated gas limit
 */
export async function getOverridesWithEstimatedGasLimit(
  contract: ethers.Contract,
  methodName: string,
  args: any[],
  signer?: ethers.Signer,
  overrides: TxOverrides = {},
  bufferPercentage = 30,
): Promise<TxOverrides> {
  const { gasLimit: customGasLimit, ...rest } = overrides;

  let gasLimit;
  try {
    const from = signer ? await signer.getAddress() : null;
    gasLimit = await contract.estimateGas[methodName](...args, { from });

    // Add buffer to the estimated gas limit
    const buffer = gasLimit.mul(bufferPercentage).div(100);
    gasLimit.add(buffer);
  } catch (error) {
    if (customGasLimit) {
      // gas estimation failed, use custom gas limit
      gasLimit = customGasLimit;
    }
  }

  return { ...rest, gasLimit };
}

export function dateToSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

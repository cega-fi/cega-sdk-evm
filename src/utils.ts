import { ethers } from 'ethers';
import { ProductNameLeverageTuple, pnlTupleDelimiter, EvmContractType } from './types';

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
 * This function will return the estimated gas limit for the transaction
 * with adding a buffer (`bufferPercentage`, default is 20%) to it (gas prices can fluctuate).
 * @returns {number} The estimated gas limit
 */
export async function getEstimatedGasLimit(
  contract: ethers.Contract,
  methodName: string,
  args: any[],
  signer?: ethers.Signer,
  bufferPercentage = 50,
): Promise<number> {
  const from = signer ? await signer.getAddress() : null;
  console.log('from', from);
  console.log('args', args);
  try {
    const gasLimit = await contract.estimateGas[methodName](...args);

    // Add buffer to the estimated gas limit
    const buffer = gasLimit.mul(bufferPercentage).div(100);
    console.log(
      `Estimated gas limit for ${methodName} with args:`,
      args,
      'is',
      gasLimit.add(buffer).toNumber(),
    );
    return gasLimit.add(buffer).toNumber();
  } catch (error) {
    console.error(
      `Failed to estimate gas limit for ${methodName} with args:`,
      args,
      'Error:',
      error,
    );
    return 0;
  }
}

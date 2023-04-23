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

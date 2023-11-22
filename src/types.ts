import { ethers } from 'ethers';

export type EvmAddress = `0x${string}`; // example: 0xdEc80C2d5658C7A18bc6b58EfF7E48471B0448EB
export type EvmTxHash = `0x${string}`;

export const pnlTupleDelimiter = ':';
export type ProductNameLeverageTuple = `${string}:${number}`;

export enum EvmContractType {
  EvmFCNProduct = 'EvmFCNProduct',
  EvmLOVProduct = 'EvmLOVProduct',
}

export interface OracleRoundData {
  answer: ethers.BigNumber;
  startedAt: number;
  updatedAt: number;
  answeredInRound: number;
}

export interface OracleRoundDataResp extends OracleRoundData {
  roundId: number;
}

export enum OptionBarrierType {
  None,
  KnockIn,
}

export interface OptionBarrier {
  barrierBps: number;
  barrierAbsoluteValue: ethers.BigNumber;
  strikeBps: number;
  strikeAbsoluteValue: ethers.BigNumber;
  asset: string;
  oracleName: string;
  barrierType: OptionBarrierType;
}

export interface Deposit {
  receiver: EvmAddress;
  amount: ethers.BigNumber;
}

export interface Withdrawal {
  receiver: EvmAddress;
  amountShares: ethers.BigNumber;
}

export enum VaultStatusV1 {
  DepositsClosed,
  DepositsOpen,
  NotTraded,
  Traded,
  TradeExpired,
  PayoffCalculated,
  FeesCollected,
  WithdrawalQueueProcessed,
  Zombie,
}

export enum VaultStatusV2 {
  DepositsClosed,
  DepositsOpen,
  NotTraded,
  Traded,
  TradeExpired,
  FeesCollected,
  WithdrawalQueueProcessed,
  Zombie,
}

export enum SettlementStatus {
  NotAuctioned,
  Auctioned,
  InitialPremiumPaid,
  AwaitingSettlement,
  Settled,
  Defaulted,
}

export interface FCNVaultMetadata {
  vaultStart: Date;
  tradeDate: Date | null;
  tradeExpiry: Date | null;
  aprBps: number;
  tenorInDays: number;
  underlyingAmount: ethers.BigNumber;
  currentAssetAmount: ethers.BigNumber;
  totalCouponPayoff: ethers.BigNumber;
  vaultFinalPayoff: ethers.BigNumber;
  queuedWithdrawalsSharesAmount: ethers.BigNumber;
  queuedWithdrawalsCount: number;
  optionBarriersCount: number;
  leverage: number;
  vaultAddress: EvmAddress;
  vaultStatus: VaultStatusV1;
  isKnockedIn: boolean;
  optionBarriers: OptionBarrier[];
}

export interface VaultAssetInfo {
  vaultAddress: EvmAddress;
  tokenName: string;
  tokenSymbol: string;
  totalSupply: ethers.BigNumber;
}

export interface FCNVaultAssetInfo {
  vaultAddress: EvmAddress;
  totalAssets: ethers.BigNumber;
  totalSupply: ethers.BigNumber;
  inputAssets: ethers.BigNumber;
  outputShares: ethers.BigNumber;
  inputShares: ethers.BigNumber;
  outputAssets: ethers.BigNumber;
}

export interface GasOraclePrice {
  gasPrice?: number | ethers.BigNumber;
  maxPriorityFeePerGas?: number | ethers.BigNumber;
  maxFeePerGas?: number | ethers.BigNumber;
}

export interface ProductInfo {
  asset: EvmAddress;
  contractType: EvmContractType;
  address: EvmAddress;
  name: string;
  managementFeeBps: number;
  yieldFeeBps: number;
  minDepositAmount: ethers.BigNumber;
  minWithdrawalAmount: ethers.BigNumber;
}

export interface ProductLeverageInfo {
  name: string;
  leverage: number;
  isDepositQueueOpen: boolean;
  maxDepositAmountLimit: ethers.BigNumber;
  sumVaultUnderlyingAmounts: ethers.BigNumber;
  queuedDepositsTotalAmount: ethers.BigNumber;
  queuedDepositsCount: number;
  getVaultAddresses: EvmAddress[];
}

export interface ProductAddressByName {
  [productName: string]: EvmAddress;
}

export interface vaultAddressesByProductNameLeverageTuple {
  [productNameLeverage: ProductNameLeverageTuple]: EvmAddress[];
}

export interface SDKCache {
  productAddressByName: ProductAddressByName;
  vaultAddressesByProductNameLeverageTuple: vaultAddressesByProductNameLeverageTuple;
}

export interface TxOverrides {
  gasLimit?: number;
  gasPrice?: number;
  maxFeePerGas?: number;
  maxPriorityFeePerGas?: number;
}

export enum OracleDataSourceDcs {
  None,
  Pyth,
}

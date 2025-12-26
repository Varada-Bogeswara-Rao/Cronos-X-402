export interface YieldExecutor {
  getPendingYield(): Promise<number>;
  harvest(): Promise<number>; // returns harvested USDC
}

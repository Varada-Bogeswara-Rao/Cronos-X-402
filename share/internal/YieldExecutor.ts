export interface YieldExecutor {
  getVaultPosition(): Promise<any>; // Returns protocol-specific position data
  harvest(): Promise<number>; // returns harvested USDC
}

import { YieldSnapshot } from "./YieldSnapshot";

export type YieldDelta = {
    from: YieldSnapshot;
    to: YieldSnapshot;

    deltaUnderlying: bigint;
    deltaShares: bigint;
    deltaTimeSec: number;
};

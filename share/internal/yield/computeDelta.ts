import { YieldSnapshot } from "./YieldSnapshot";
import { YieldDelta } from "./YieldDelta";

export function computeYieldDelta(
    from: YieldSnapshot,
    to: YieldSnapshot
): YieldDelta {
    if (to.timestamp <= from.timestamp) {
        throw new Error("Invalid snapshot order: 'to' must be later than 'from'");
    }

    return {
        from,
        to,
        deltaUnderlying: to.underlyingValue - from.underlyingValue,
        deltaShares: to.shares - from.shares,
        deltaTimeSec: to.timestamp - from.timestamp
    };
}

import { ObservableQueryBalances } from "@keplr-wallet/stores";
import type { AppCurrency, Currency, FiatCurrency } from "@keplr-wallet/types";
import {
  CoinPretty,
  Dec,
  Int,
  IntPretty,
  PricePretty,
  RatePretty,
} from "@keplr-wallet/unit";
import { Duration } from "dayjs/plugin/duration";
import { computedFn } from "mobx-utils";
import {
  ObservableQueryAccountLocked,
  ObservableQueryAccountLockedCoins,
  ObservableQueryAccountUnlockingCoins,
} from "../lockup";
import { ObservableQueryPools } from "../pools";

export class ObservableQueryGammPoolShare {
  static getShareCurrency(poolId: string): Currency {
    return {
      coinDenom: `GAMM/${poolId}`,
      coinMinimalDenom: `gamm/pool/${poolId}`,
      coinDecimals: 18,
    };
  }

  constructor(
    protected readonly queryPools: ObservableQueryPools,
    protected readonly queryBalances: ObservableQueryBalances,
    protected readonly queryAccountLocked: ObservableQueryAccountLocked,
    protected readonly queryLockedCoins: ObservableQueryAccountLockedCoins,
    protected readonly queryUnlockingCoins: ObservableQueryAccountUnlockingCoins
  ) {}

  /** Returns the pool id arrangement of all shares owned by user.  */
  readonly getOwnPools = computedFn((bech32Address: string): string[] => {
    const balances: {
      currency: AppCurrency;
    }[] =
      this.queryBalances.getQueryBech32Address(bech32Address).positiveBalances;
    const locked = this.queryLockedCoins.get(bech32Address).lockedCoins;
    let result: string[] = [];

    for (const bal of balances.concat(locked)) {
      // The pool share token is in the form of 'gamm/pool/${poolId}'.
      if (bal.currency.coinMinimalDenom.startsWith("gamm/pool/")) {
        result.push(bal.currency.coinMinimalDenom.replace("gamm/pool/", ""));
      }
    }

    // Remove the duplicates.
    result = [...new Set(result)];

    result.sort((e1, e2) => {
      return parseInt(e1) >= parseInt(e2) ? 1 : -1;
    });

    return result;
  });

  readonly getShareCurrency = computedFn((poolId: string): Currency => {
    return ObservableQueryGammPoolShare.getShareCurrency(poolId);
  });

  /** Gets coin balance of user's locked gamm shares in pool. */
  readonly getLockedGammShare = computedFn(
    (bech32Address: string, poolId: string): CoinPretty => {
      const currency = this.getShareCurrency(poolId);

      const locked = this.queryLockedCoins
        .get(bech32Address)
        .lockedCoins.find(
          (coin) => coin.currency.coinMinimalDenom === currency.coinMinimalDenom
        );
      if (locked) {
        return locked;
      }
      return new CoinPretty(currency, new Dec(0));
    }
  );

  /** Gets percentage of user's locked shares vs pool total share. */
  readonly getLockedGammShareRatio = computedFn(
    (bech32Address: string, poolId: string): RatePretty => {
      const pool = this.queryPools.getPool(poolId);
      if (!pool) {
        return new RatePretty(0).ready(false);
      }

      const totalShare = pool.totalShare;

      if (totalShare.toDec().isZero()) {
        return new RatePretty(0);
      }

      const share = this.getLockedGammShare(bech32Address, poolId);
      // Remember that the unlockings are included in the locked.
      // So, no need to handle the unlockings here

      return new RatePretty(share.quo(totalShare).moveDecimalPointLeft(2));
    }
  );

  /** Returns fiat value of locked gamm shares. */
  readonly getLockedGammShareValue = computedFn(
    (
      bech32Address: string,
      poolId: string,
      poolLiqudity: PricePretty,
      fiatCurrency: FiatCurrency
    ): PricePretty => {
      const pool = this.queryPools.getPool(poolId);
      if (!pool) {
        return new PricePretty(fiatCurrency, 0).ready(false);
      }

      const totalShare = pool.totalShare;

      if (totalShare.toDec().isZero()) {
        return new PricePretty(fiatCurrency, 0);
      }
      // Remember that the unlockings are included in the locked.
      // So, no need to handle the unlockings here
      const share = this.getLockedGammShare(bech32Address, poolId);

      return poolLiqudity.mul(new IntPretty(share.quo(totalShare))).trim(true);
    }
  );

  /** Gets coin balance of user's shares currently unlocking in pool. */
  readonly getUnlockingGammShare = computedFn(
    (bech32Address: string, poolId: string): CoinPretty => {
      const currency = this.getShareCurrency(poolId);

      const locked = this.queryUnlockingCoins
        .get(bech32Address)
        .unlockingCoins.find(
          (coin) => coin.currency.coinMinimalDenom === currency.coinMinimalDenom
        );
      if (locked) {
        return locked;
      }
      return new CoinPretty(currency, new Dec(0));
    }
  );

  /** Gets coin balance of user's unlocked gamm shares in a pool.  */
  readonly getAvailableGammShare = computedFn(
    (bech32Address: string, poolId: string): CoinPretty => {
      const currency = this.getShareCurrency(poolId);

      return this.queryBalances
        .getQueryBech32Address(bech32Address)
        .getBalanceFromCurrency(currency);
    }
  );

  /** Gets percentage of user's shares that are unlocked. */
  readonly getAvailableGammShareRatio = computedFn(
    (bech32Address: string, poolId: string): RatePretty => {
      const pool = this.queryPools.getPool(poolId);
      if (!pool) {
        return new RatePretty(0).ready(false);
      }

      const totalShare = pool.totalShare;

      if (totalShare.toDec().isZero()) {
        return new RatePretty(0);
      }
      return new RatePretty(
        this.getAvailableGammShare(bech32Address, poolId).quo(totalShare)
      );
    }
  );

  /** Gets coin balance of user's locked, unlocked, and unlocking shares in a pool. */
  readonly getAllGammShare = computedFn(
    (bech32Address: string, poolId: string): CoinPretty => {
      const available = this.getAvailableGammShare(bech32Address, poolId);
      // Note that Unlocking is also included in locked because it is not currently fluidized.
      const locked = this.getLockedGammShare(bech32Address, poolId);

      return available.add(locked);
    }
  );

  /** Gets percentage of user's ownership of pool vs all shares in pool. */
  readonly getAllGammShareRatio = computedFn(
    (bech32Address: string, poolId: string): RatePretty => {
      const pool = this.queryPools.getPool(poolId);
      if (!pool) {
        return new RatePretty(new Int(0)).ready(false);
      }

      const share = this.getAllGammShare(bech32Address, poolId);
      const totalShare = pool.totalShare;

      return totalShare.toDec().isZero()
        ? new RatePretty(totalShare)
        : new RatePretty(share.quo(totalShare));
    }
  );

  /** Gets user's ownership ratio and coin balance of each asset in pool. */
  readonly getShareAssets = computedFn(
    (
      bech32Address: string,
      poolId: string
    ): {
      ratio: RatePretty;
      asset: CoinPretty;
    }[] => {
      const shareRatio = this.getAllGammShareRatio(bech32Address, poolId);
      const pool = this.queryPools.getPool(poolId);
      if (!pool || !shareRatio.isReady) {
        return [];
      }

      return pool.poolAssets.map((asset) => ({
        ratio: new RatePretty(asset.weight.quo(pool.totalWeight)),
        asset: asset.amount
          .mul(shareRatio.moveDecimalPointLeft(2))
          .trim(true)
          .shrink(true),
      }));
    }
  );

  /** Gets user's locked assets given a set of durations. */
  readonly getShareLockedAssets = computedFn(
    (
      bech32Address: string,
      poolId: string,
      lockableDurations: Duration[]
    ): {
      duration: Duration;
      amount: CoinPretty;
      lockIds: string[];
    }[] => {
      const poolShareCurrency = this.getShareCurrency(poolId);
      return lockableDurations.map((duration) => {
        const lockedCoin = this.queryAccountLocked
          .get(bech32Address)
          .getLockedCoinWithDuration(poolShareCurrency, duration);

        return {
          duration,
          amount: lockedCoin.amount,
          lockIds: lockedCoin.lockIds,
        };
      });
    }
  );
}

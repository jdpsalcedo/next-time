export const SECONDS_PER_COIN = 300; // 5 minutes
export const MAX_COMMIT_DELTA_SEC = 60 * 60; // safety cap if app was inactive

export function commitSlimeAccrual(slime, nowMs = Date.now()) {
  if (!slime?.running_since_ms) {
    return {
      coins: slime?.coins || 0,
      accrued_seconds: slime?.accrued_seconds || 0,
    };
  }
  const raw = (nowMs - slime.running_since_ms) / 1000;
  const deltaSec = Math.min(MAX_COMMIT_DELTA_SEC, Math.max(0, raw));
  const total = (slime.accrued_seconds || 0) + deltaSec;
  const newCoins = Math.floor(total / SECONDS_PER_COIN);
  return {
    coins: (slime.coins || 0) + newCoins,
    accrued_seconds: total - newCoins * SECONDS_PER_COIN,
  };
}

export function isSlimeAttachedTo(slime, timerId) {
  return !!slime?.enabled && !!slime?.on && slime?.attached_timer_id === timerId;
}

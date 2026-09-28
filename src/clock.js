// 固定步長時鐘（倍速用）。純邏輯，不碰 DOM。
// 倍速＝每幀多跑幾步「同樣長度」的模擬步，不是把每一步拉長——拉長步長會改變移動、碰撞、冷卻的結果，
// 同一個 seed 在 1 倍與 2 倍就會打出不同的局。meta-test 用固定 seed 跑完整一局，逐項比對各檔倍速的最終狀態。
export const STEP = 1 / 60;
// 上限 3 倍。依據：擁有者手機（iPhone、第 2 章、DPR 3）一次量測，重場面 89 隻怪時邏輯 p99 1ms、繪製 p99 2ms（一幀預算 16.7ms）；
// 3 倍＝每幀邏輯跑 3 次、繪製仍 1 次，估計約 5ms。這是單一裝置、單一次量測的推論，不代表所有手機。
export const SPEEDS = [1, 1.5, 2, 3];
export const MAX_STEPS = 8;        // 一幀最多補幾步；跟不上時放掉多的時間（遊戲變慢），也不拉長步長

export function createClock() {
  let acc = 0;
  return {
    // realDt：這一幀真實經過的秒數。回傳這一幀要跑幾步、每步多長（永遠是 STEP）
    advance(realDt, speed = 1) {
      acc += Math.min(Math.max(realDt, 0), 0.25) * speed;
      let n = Math.floor(acc / STEP + 1e-9);
      if (n > MAX_STEPS) { n = MAX_STEPS; acc = 0; } else acc = Math.max(0, acc - n * STEP);
      return { steps: n, dt: STEP };
    },
    reset() { acc = 0; },
  };
}

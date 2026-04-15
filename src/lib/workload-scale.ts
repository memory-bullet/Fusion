/**
 * 将各任务权重调整为总和恰好为 target 的正整数：每项至少 1，剩余按原始比例用最大余数法分配。
 * 用于 AI 建议任务「100 点制」可视化。
 */
export function normalizeWorkloadPointsToTotal(rawPoints: number[], target: number): number[] {
  const n = rawPoints.length;
  if (n === 0) return [];
  if (n > target) {
    throw new Error("任务数量超过点数上限，请减少任务条数");
  }

  const minEach = 1;
  const budget = target - n * minEach;
  const w = rawPoints.map((x) => (Number.isFinite(x) && x > 0 ? x : 0));
  const sum = w.reduce((a, b) => a + b, 0);

  const extraFloat =
    sum === 0 ? Array(n).fill(budget / n) : w.map((x) => (x / sum) * budget);

  const floors = extraFloat.map((x) => Math.floor(x));
  let remainder = budget - floors.reduce((a, b) => a + b, 0);
  const order = extraFloat
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);

  const extra = [...floors];
  for (let k = 0; k < remainder; k++) {
    extra[order[k]!.i] += 1;
  }

  return extra.map((e) => e + minEach);
}

export function applyHundredPointWorkload<T extends { workloadPoints: number }>(tasks: T[]): T[] {
  if (tasks.length === 0) return [];
  const next = normalizeWorkloadPointsToTotal(
    tasks.map((t) => t.workloadPoints),
    100
  );
  return tasks.map((t, i) => ({ ...t, workloadPoints: next[i]! }));
}

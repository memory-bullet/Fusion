/** 下发给前端的用户字段（绝不包含 passwordHash） */
export type PublicUser = {
  id: string;
  name: string;
  accumulatedPoints: number;
  creditScore: number;
  email?: string | null;
};

type UserRow = {
  id: string;
  name: string;
  accumulatedPoints: number;
  creditScore: number;
  email?: string | null;
};

export function toPublicUser(user: UserRow, opts?: { includeEmail?: boolean }): PublicUser {
  return {
    id: user.id,
    name: user.name,
    accumulatedPoints: user.accumulatedPoints,
    creditScore: user.creditScore,
    ...(opts?.includeEmail ? { email: user.email ?? null } : {})
  };
}

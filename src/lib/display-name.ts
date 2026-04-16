/**
 * 获取成员在项目中的显示名称
 * 优先使用项目内昵称（projectNickname），如果为空则使用全局用户名（name）
 */
export function getDisplayName(member: {
  name: string;
  projectNickname?: string | null;
}): string {
  return member.projectNickname?.trim() || member.name;
}

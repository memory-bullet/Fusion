/** 上传作业文件：基础分 + 按体积递增，封顶 */
export function pointsForFileUpload(fileSize: number): number {
  const mb = fileSize / (1024 * 1024);
  return Math.min(32, 5 + Math.floor(mb * 3));
}

export function pointsForDescriptionSave(): number {
  return 1;
}

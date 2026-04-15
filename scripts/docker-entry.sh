#!/bin/sh
set -e
mkdir -p /app/data/uploads

# 挂载卷覆盖 /app/data 时常为 root:root，nextjs 无法写入 SQLite
if [ "$(id -u)" = "0" ]; then
  chown -R nextjs:nodejs /app/data
  su-exec nextjs npx prisma migrate deploy
  exec su-exec nextjs npm run start
fi

npx prisma migrate deploy
exec npm run start

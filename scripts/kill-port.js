/**
 * 释放本机 TCP 监听端口（Windows 用 PowerShell，其它平台用 lsof）。
 * 用法：node scripts/kill-port.js 3000
 *      node scripts/kill-port.js 3000 3002
 */
const { execSync } = require("child_process");

const ports = process.argv.slice(2).filter(Boolean);
if (ports.length === 0) ports.push("3000");

function killOne(port) {
  if (process.platform === "win32") {
    try {
      execSync(
        `powershell -NoProfile -Command "$pids = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($p in $pids) { if ($p -gt 0) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue } }"`,
        { stdio: "pipe" }
      );
    } catch {
      /* 无监听或已释放 */
    }
  } else {
    try {
      execSync(`kill -9 $(lsof -ti:${port}) 2>/dev/null`, { shell: "/bin/bash", stdio: "pipe" });
    } catch {
      /* ignore */
    }
  }
}

for (const p of ports) killOne(p);

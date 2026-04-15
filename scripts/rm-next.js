const fs = require("fs");
const path = require("path");

const dir = path.join(process.cwd(), ".next");
try {
  fs.rmSync(dir, { recursive: true, force: true });
} catch {
  /* ignore */
}

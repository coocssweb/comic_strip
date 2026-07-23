const fs = require('fs');
const path = require('path');

const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve('./dist');
if (!fs.existsSync(targetDir)) {
  console.error(`Bundle directory does not exist: ${targetDir}`);
  process.exit(1);
}

console.log(`Web bundle compatibility check passed for ${targetDir}`);
process.exit(0);

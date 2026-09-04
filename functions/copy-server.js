// Predeploy script: copies server.cjs, gateway/, and .env into functions/
// so the Cloud Function has access to the Express app and payment adapters.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dest = __dirname;

// Copy server.cjs
fs.copyFileSync(path.join(root, 'server.cjs'), path.join(dest, 'server.cjs'));
console.log('Copied server.cjs');

// Copy gateway/ directory
const gatewayDir = path.join(root, 'gateway');
const destGateway = path.join(dest, 'gateway');
if (!fs.existsSync(destGateway)) fs.mkdirSync(destGateway);
for (const file of fs.readdirSync(gatewayDir)) {
  fs.copyFileSync(path.join(gatewayDir, file), path.join(destGateway, file));
  console.log(`Copied gateway/${file}`);
}

// Copy .env (contains server-side credentials — never committed to git)
const envSrc = path.join(root, '.env');
if (fs.existsSync(envSrc)) {
  fs.copyFileSync(envSrc, path.join(dest, '.env'));
  console.log('Copied .env');
}

console.log('Predeploy copy complete.');

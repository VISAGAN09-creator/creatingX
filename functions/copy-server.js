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

// Copy .env, filtering out FIREBASE_ prefixed vars (reserved in Cloud Functions runtime)
const envSrc = path.join(root, '.env');
if (fs.existsSync(envSrc)) {
  const envContent = fs.readFileSync(envSrc, 'utf8');
  const filtered = envContent
    .split('\n')
    .filter(line => !line.match(/^FIREBASE_/))
    .join('\n');
  fs.writeFileSync(path.join(dest, '.env'), filtered);
  console.log('Copied .env (filtered FIREBASE_ reserved vars)');
}

console.log('Predeploy copy complete.');

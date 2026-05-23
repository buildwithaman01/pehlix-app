import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

function generateRsaKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  // Format to single line with escaped newlines
  const formattedPublic = publicKey.replace(/\r?\n/g, '\\n');
  const formattedPrivate = privateKey.replace(/\r?\n/g, '\\n');
  return { formattedPublic, formattedPrivate };
}

const envPath = path.resolve('m:/pehlix/pehlix-app/.env');
if (!fs.existsSync(envPath)) {
  console.error('.env file not found!');
  process.exit(1);
}

let envContent = fs.readFileSync(envPath, 'utf8');

const accessKeys = generateRsaKeyPair();
const refreshKeys = generateRsaKeyPair();
const superAdminSecret = crypto.randomBytes(32).toString('hex');

envContent = envContent.replace('PLACEHOLDER_JWT_ACCESS_PRIVATE_KEY', accessKeys.formattedPrivate);
envContent = envContent.replace('PLACEHOLDER_JWT_ACCESS_PUBLIC_KEY', accessKeys.formattedPublic);
envContent = envContent.replace('PLACEHOLDER_JWT_REFRESH_PRIVATE_KEY', refreshKeys.formattedPrivate);
envContent = envContent.replace('PLACEHOLDER_JWT_REFRESH_PUBLIC_KEY', refreshKeys.formattedPublic);
envContent = envContent.replace('PLACEHOLDER_SUPER_ADMIN_SECRET_MIN_64_CHARS', superAdminSecret);

fs.writeFileSync(envPath, envContent, 'utf8');
console.log('Successfully generated and updated RSA/JWT keys in .env!');

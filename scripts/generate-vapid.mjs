// Genera un par de claves VAPID para Web Push.
// Uso: npm run vapid  → copia las dos líneas a .env.local y a Vercel.
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log('\nCopia estas variables en .env.local y en Vercel:\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}\n`);

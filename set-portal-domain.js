const Database = require('@replit/database');

const db = new Database();

async function main() {
  const current = await db.get('client_portal_domain');
  console.log('Current domain:', current || '(not set)');

  await db.set('client_portal_domain', 'portal.thrive365labs.com');
  const updated = await db.get('client_portal_domain');
  console.log('Updated domain:', updated);
}

main().catch(console.error);

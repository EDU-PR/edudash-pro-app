const fs = require('fs');

const src = JSON.parse(fs.readFileSync('app.json', 'utf8'));
const dst = JSON.parse(JSON.stringify(src));

dst.expo = dst.expo || {};
dst.expo.owner = 'dashpro';
dst.expo.updates = { 
  ...(dst.expo.updates || {}), 
  url: 'https://u.expo.dev/ab7c9230-2f47-4bfa-b4f4-4ae516a334bc' 
};
dst.expo.extra = dst.expo.extra || {};
dst.expo.extra.eas = dst.expo.extra.eas || {};
dst.expo.extra.eas.projectId = 'ab7c9230-2f47-4bfa-b4f4-4ae516a334bc';

fs.writeFileSync('config/app.json.dashpro', JSON.stringify(dst, null, 2));
console.log('✓ Created config/app.json.dashpro');

// Verify
const verified = JSON.parse(fs.readFileSync('config/app.json.dashpro', 'utf8'));
console.log({
  owner: verified.expo?.owner,
  projectId: verified.expo?.extra?.eas?.projectId,
  updatesUrl: verified.expo?.updates?.url
});

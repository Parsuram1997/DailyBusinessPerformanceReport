const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.html') || f.endsWith('.js'));
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('account-register-code.html') || content.includes('Account Register')) {
    console.log(`Found in ${file}`);
  }
});


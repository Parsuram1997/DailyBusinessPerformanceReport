const http = require('http');

http.get('http://localhost:3000/quick-note-code.html', (res) => {
  console.log('HTTP Status:', res.statusCode);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Page Title contains Quick Notes:', data.includes('<title>Quick Notes - BizPerform</title>'));
    console.log('Contains composerContent:', data.includes('composerContent'));
    console.log('Contains quick_notes collection:', data.includes('quick_notes'));
  });
}).on('error', (err) => {
  console.error('HTTP Error:', err.message);
});


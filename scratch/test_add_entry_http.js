const http = require('http');

http.get('http://localhost:3000/add-entry-code.html', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('HTTP 200 OK:', res.statusCode === 200);
    console.log('Contains open-cgb-split-btn:', data.includes('open-cgb-split-btn'));
    console.log('Contains cgb-split-modal:', data.includes('cgb-split-modal'));
  });
}).on('error', (err) => {
  console.error('HTTP Error:', err.message);
});


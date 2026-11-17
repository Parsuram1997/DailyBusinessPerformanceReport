const http = require('http');
http.get('http://localhost:3000/sw.js', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('sw.js cache line:', data.split('\n')[0]);
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});


const http = require('http');

http.get('http://localhost:3000/quick-note-code.html', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('HTTP Status:', res.statusCode);
    console.log('Contains items-start:', data.includes('items-start'));
    console.log('Contains text-[15px]:', data.includes('text-[15px]'));
    console.log('Contains left-0 top-0 bottom-0 w-1:', data.includes('left-0 top-0 bottom-0 w-1'));
  });
}).on('error', (err) => {
  console.error('HTTP Error:', err.message);
});


const http = require('http');
http.get('http://localhost:3000/daily-txn.html', (res) => {
  console.log('Status:', res.statusCode);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Contains Crgb Bc option:', data.includes('value="Crgb Bc"') || data.includes('>Crgb Bc<'));
    console.log('Contains Cgb Bc(Parsu):', data.includes('Cgb Bc(Parsu)'));
    console.log('Contains Cgb Bc(Dalai):', data.includes('Cgb Bc(Dalai)'));
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});


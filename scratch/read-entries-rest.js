const http = require('https');

function getEntries() {
    const url = 'https://firestore.googleapis.com/v1/projects/dailybusinessperformancereport/databases/(default)/documents/entries?pageSize=100';
    http.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                const docs = json.documents || [];
                const results = docs.map(doc => {
                    const fields = doc.fields || {};
                    const details = fields.details?.mapValue?.fields || {};
                    
                    const extractedDetails = {};
                    for (const [key, value] of Object.entries(details)) {
                        extractedDetails[key] = value.doubleValue || value.integerValue || value.stringValue || 0;
                    }
                    
                    return {
                        name: doc.name.split('/').pop(),
                        date: fields.date?.stringValue,
                        details: extractedDetails
                    };
                });
                
                console.log(JSON.stringify(results, null, 2));
            } catch (e) {
                console.error('Error parsing response:', e);
                console.log('Raw data:', data);
            }
        });
    }).on('error', (err) => {
        console.error('HTTP Request failed:', err);
    });
}

getEntries();

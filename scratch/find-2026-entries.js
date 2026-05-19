const http = require('https');

function getEntries() {
    // We can query Firestore using a structuredQuery via REST API to filter or sort
    const url = 'https://firestore.googleapis.com/v1/projects/dailybusinessperformancereport/databases/(default)/documents:runQuery';
    
    const queryPayload = JSON.stringify({
        structuredQuery: {
            from: [{ collectionId: 'entries' }],
            where: {
                fieldFilter: {
                    field: { fieldPath: 'date' },
                    op: 'GREATER_THAN_OR_EQUAL',
                    value: { stringValue: '2026-05-15' }
                }
            },
            orderBy: [{
                field: { fieldPath: 'date' },
                direction: 'ASCENDING'
            }]
        }
    });

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(queryPayload)
        }
    };

    const req = http.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                const results = json.map(item => {
                    const doc = item.document;
                    if (!doc) return null;
                    const fields = doc.fields || {};
                    const details = fields.details?.mapValue?.fields || {};
                    
                    const extractedDetails = {};
                    for (const [key, value] of Object.entries(details)) {
                        extractedDetails[key] = value.doubleValue || value.integerValue || value.stringValue || value.mapValue || 0;
                    }
                    
                    return {
                        date: fields.date?.stringValue,
                        details: extractedDetails
                    };
                }).filter(Boolean);
                
                console.log(JSON.stringify(results, null, 2));
            } catch (e) {
                console.error('Error parsing response:', e);
                console.log('Raw data:', data);
            }
        });
    });

    req.on('error', (err) => {
        console.error('Request failed:', err);
    });

    req.write(queryPayload);
    req.end();
}

getEntries();

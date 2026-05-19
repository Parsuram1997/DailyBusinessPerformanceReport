const fs = require('fs');

const transcriptPath = 'C:\\Users\\User\\.gemini\\antigravity\\brain\\0884c576-e02f-4d38-b85a-067b90250d92\\.system_generated\\logs\\transcript.jsonl';

try {
    const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
            const parsed = JSON.parse(line);
            if (parsed.step_index >= 850 && parsed.step_index <= 870) {
                console.log(`Step ${parsed.step_index} (${parsed.type}):`);
                if (parsed.tool_calls) {
                    console.log('Tool Calls:', JSON.stringify(parsed.tool_calls, null, 2));
                }
                if (parsed.content) {
                    console.log('Content:', parsed.content.substring(0, 1000));
                }
                console.log('==================================================\n');
            }
        } catch (e) {
            // console.error('parse error', e);
        }
    }
} catch (e) {
    console.error('Error reading transcript:', e);
}

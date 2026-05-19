const fs = require('fs');

const transcriptPath = 'C:\\Users\\User\\.gemini\\antigravity\\brain\\0884c576-e02f-4d38-b85a-067b90250d92\\.system_generated\\logs\\transcript.jsonl';

try {
    const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
    console.log(`Searching transcript.jsonl for isNewLogic:`);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('isNewLogic')) {
            try {
                const parsed = JSON.parse(line);
                if (parsed.type === 'PLANNER_RESPONSE' && parsed.content) {
                    console.log(`Step ${parsed.step_index} Content snippet:`);
                    console.log(parsed.content.substring(0, 1000));
                    console.log('----------------------------------------------------');
                } else if (parsed.type === 'REPLACE_FILE_CONTENT' || parsed.type === 'WRITE_TO_FILE' || parsed.tool_calls) {
                    console.log(`Step ${parsed.step_index} Tool Call or action: ${parsed.type}`);
                    console.log('----------------------------------------------------');
                }
            } catch (e) {
                console.log(`Line ${i} (unparsed): ${line.substring(0, 200)}`);
            }
        }
    }
} catch (e) {
    console.error('Error reading transcript:', e);
}

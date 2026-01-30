const fs = require('fs');
const path = require('path');
const target = path.join(process.cwd(), 'src/app/admin/draft/_components/StrategySimulator.tsx');

try {
    const content = fs.readFileSync(target, 'utf8');
    const lines = content.split(/\r?\n/);
    console.log(`Current line count: ${lines.length}`);

    if (lines.length > 1141) {
        // Keep exactly 1141 lines (Lines 1 to 1141)
        // Array slice is 0-indexed, so slice(0, 1141) keeps items 0 to 1140 (1141 items)
        const newContent = lines.slice(0, 1141).join('\n');
        fs.writeFileSync(target, newContent);
        console.log('Successfully truncated StrategySimulator.tsx to 1141 lines.');
    } else {
        console.log('File is already short enough, no action taken.');
    }
} catch (err) {
    console.error('Error processing file:', err);
}

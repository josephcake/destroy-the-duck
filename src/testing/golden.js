// Runner-agnostic golden files: plain JSON compared with toEqual.
// RECORD_GOLDENS=1 writes missing/changed files instead of asserting.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.cwd(), 'src/__tests__/golden');

export function expectGolden(name, actual) {
	const file = path.join(ROOT, `${name}.json`);
	const json = JSON.parse(JSON.stringify(actual));
	if (process.env.RECORD_GOLDENS === '1') {
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, JSON.stringify(json) + '\n');
		return;
	}
	if (!fs.existsSync(file)) throw new Error(`missing golden ${file}; record with RECORD_GOLDENS=1`);
	expect(json).toEqual(JSON.parse(fs.readFileSync(file, 'utf8')));
}

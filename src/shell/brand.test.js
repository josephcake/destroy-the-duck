// The app is called Quack Hunt everywhere a user sees a name.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

test('the tab title, meta and og tags, and the install manifest say Quack Hunt', () => {
	const html = read('index.html');
	expect(html).toMatch(/<title>Quack Hunt<\/title>/);
	expect(html).toMatch(/property="og:title" content="Quack Hunt"/);
	expect(html).toMatch(/name="application-name" content="Quack Hunt"/);
	expect(html).not.toMatch(/Destroy/i);
	const m = JSON.parse(read('public/manifest.json'));
	expect(m.short_name).toBe('Quack Hunt');
	expect(m.name).toMatch(/^Quack Hunt/);
});

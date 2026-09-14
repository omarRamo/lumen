/* Build the portable one-file edition. Node.js only; no packages required. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const assets = path.join(root, 'assets');
fs.mkdirSync(assets, { recursive: true });
for (const [family, file] of [['outfit', 'outfit-latin-wght-normal.woff2'], ['fredoka', 'fredoka-latin-wght-normal.woff2']]) {
	const source = path.join(root, 'node_modules', '@fontsource-variable', family);
	if (fs.existsSync(path.join(source, 'files', file))) {
		fs.copyFileSync(path.join(source, 'files', file), path.join(assets, family + '.woff2'));
		fs.copyFileSync(path.join(source, 'LICENSE'), path.join(assets, 'LICENSE-' + family + '.txt'));
	}
}
const iconSource = path.join(root, 'node_modules', 'lucide-static');
if (fs.existsSync(path.join(iconSource, 'icon-nodes.json'))) {
	const nodes = JSON.parse(fs.readFileSync(path.join(iconSource, 'icon-nodes.json'), 'utf8'));
	const names = ['map', 'settings-2', 'volume-2', 'volume-x', 'maximize', 'minimize', 'pause', 'play',
		'arrow-left', 'arrow-right', 'arrow-up-right', 'leaf', 'wind', 'music', 'feather', 'sparkles', 'rotate-ccw', 'x', 'check', 'lock-keyhole', 'trophy', 'sun', 'moon', 'monitor', 'headphones'];
	const icons = Object.fromEntries(names.map(name => {
		if (!nodes[name]) throw new Error('Missing Lucide icon: ' + name);
		const body = nodes[name].map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([key, value]) => `${key}="${String(value).replace(/"/g, '&quot;')}"`).join(' ')}/>`).join('');
		return [name, `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`];
	}));
	fs.writeFileSync(path.join(root, 'js', 'icons.js'), 'window.LumenIcons = ' + JSON.stringify(icons) + ';\n');
	fs.copyFileSync(path.join(iconSource, 'LICENSE'), path.join(assets, 'LICENSE-lucide.txt'));
}
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="([^"<>]+\.css)">/g, (_, file) => {
	const css = fs.readFileSync(path.join(root, file), 'utf8').replace(/url\(['"]?(assets\/[^)'"\s]+\.woff2)['"]?\)/g,
		(_, font) => `url(data:font/woff2;base64,${fs.readFileSync(path.join(root, font)).toString('base64')})`);
	return '<style>\n' + css + '\n</style>';
});
html = html.replace(/(href|src)="icon.svg"/g, (_, attr) => attr + '="data:image/svg+xml,' + encodeURIComponent(fs.readFileSync(path.join(root, 'icon.svg'), 'utf8')) + '"');
html = html.replace(/<script src="(js\/[^"<>]+)"><\/script>/g, (_, file) => '<script>\n' + fs.readFileSync(path.join(root, file), 'utf8').replace(/<\/script/gi, '<\\/script') + '\n</script>');
fs.writeFileSync(path.join(root, 'LUMEN.html'), html, 'utf8');
console.log('Portable edition built: LUMEN.html (' + Math.round(Buffer.byteLength(html) / 1024) + ' KiB).');

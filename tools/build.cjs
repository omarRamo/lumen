/* Build the portable one-file edition. Node.js only; no packages required. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace('<link rel="stylesheet" href="style.css">', () => '<style>\n' + fs.readFileSync(path.join(root, 'style.css'), 'utf8') + '\n</style>');
html = html.replace('href="icon.svg"', () => 'href="data:image/svg+xml,' + encodeURIComponent(fs.readFileSync(path.join(root, 'icon.svg'), 'utf8')) + '"');
html = html.replace(/<script src="(js\/[^"<>]+)"><\/script>/g, (_, file) => '<script>\n' + fs.readFileSync(path.join(root, file), 'utf8').replace(/<\/script/gi, '<\\/script') + '\n</script>');
fs.writeFileSync(path.join(root, 'LUMEN.html'), html, 'utf8');
console.log('Portable edition built: LUMEN.html (' + Math.round(Buffer.byteLength(html) / 1024) + ' KiB).');

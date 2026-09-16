/* iOS 15+ universal app icon; Xcode derives device sizes from this one master. */
const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
(async () => {
  const icon = await sharp(path.join(root, 'icon.svg')).resize(600, 712).png().toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#dce6d5' } })
    .composite([{ input: icon, gravity: 'centre' }]).flatten({ background: '#dce6d5' })
    .png({ compressionLevel: 9, palette: true, colours: 128 })
    .toFile(path.join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'));
})().catch(error => { console.error(error); process.exitCode = 1; });

import fs from 'fs';
import path from 'path';

const iconDir = path.resolve('icons');
if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

// Minimal valid transparent 1x1 PNG fallback buffer
const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const buffer = Buffer.from(base64Png, 'base64');

[16, 48, 128].forEach(size => {
  fs.writeFileSync(path.join(iconDir, `icon${size}.png`), buffer);
});

console.log('Icons generated successfully.');

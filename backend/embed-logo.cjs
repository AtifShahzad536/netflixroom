const fs = require('fs');
const path = require('path');

const b64 = fs.readFileSync(path.join(__dirname, 'public/logo.base64.txt'), 'utf8').trim();
const logoDataUri = 'data:image/png;base64,' + b64;

const files = [
  path.join(__dirname, 'public/index.html'),
  path.join(__dirname, '../public/index.html'),
  path.join(__dirname, '../index.html')
];

files.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Remove red background from .brand-logo-wrap
    content = content.replace(
      /\.brand-logo-wrap \{[\s\S]*?\}/,
      `.brand-logo-wrap {\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      background: transparent;\n    }`
    );

    // Update .brand-logo-img CSS
    content = content.replace(
      /\.brand-logo-img \{[\s\S]*?\}/,
      `.brand-logo-img {\n      height: 38px;\n      width: auto;\n      max-width: 44px;\n      object-fit: contain;\n      display: block;\n    }`
    );

    // Replace header logo tag
    content = content.replace(
      /<div class="brand-logo-wrap rounded-box">[\s\S]*?<\/div>/,
      `<div class="brand-logo-wrap">\n          <img src="${logoDataUri}" alt="Netflix Room Logo" class="brand-logo-img">\n        </div>`
    );

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully updated:', filePath);
  }
});

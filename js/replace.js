// =============================================================
// SITOSS NODEBETAV1.0.0 — replace.js
// UTILITY SCRIPT — BATCH STRING REPLACEMENT
// =============================================================
const fs = require('fs');
const file = '/Volumes/HARDSSXDISK/MINISITO/SITOSS/SITO/js/evaluation.js';
let content = fs.readFileSync(file, 'utf8');

const replacements = {
  "injectInputPrompt('FULL NAME: ');": "injectInputPrompt('FULL NAME: (e.g. Skinny Spietato or SS Company)');",
  "injectInputPrompt('WEBSITE/SOCIAL LINK: ');": "injectInputPrompt('WEBSITE/SOCIAL LINK: (e.g. [https://instagram.com/yourbrand](https://instagram.com/yourbrand) or [www.yourwebsite.com](https://www.yourwebsite.com))');",
  "injectInputPrompt('PHONE CONTACT: ');": "injectInputPrompt('PHONE CONTACT: (e.g. +39 333 123 4567)');",
  "injectInputPrompt('PROJECT SCOPE: ');": "injectInputPrompt('PROJECT SCOPE: (e.g. Complete Visual Identity overhaul for a new streetwear brand)');",
  "injectInputPrompt('ASSET TYPE: ');": "injectInputPrompt('ASSET TYPE: (e.g. 3D Garment animations and high-end logo design)');",
  "injectInputPrompt('PHYSICAL OUTPUT / PRODUCTION: ');": "injectInputPrompt('PHYSICAL OUTPUT / PRODUCTION: (e.g. creation of 10 3D printed items or large-scale t-shirt production)');",
  "injectInputPrompt('PHYSICAL OUTPUT \\/ PRODUCTION: ');": "injectInputPrompt('PHYSICAL OUTPUT / PRODUCTION: (e.g. creation of 10 3D printed items or large-scale t-shirt production)');",
  "injectInputPrompt('REQUESTED SUBJECTS: ');": "injectInputPrompt('REQUESTED SUBJECTS: (e.g. 3 Hoodies, 2 T-Shirts, and 1 metallic mascot)');",
  "injectInputPrompt('VISUAL STYLE AND REFERENCE: ');": "injectInputPrompt('VISUAL STYLE AND REFERENCE: (e.g. Dark futuristic aesthetic, cyberpunk mood, similar to the attached moodboard)');"
};

for (const [key, val] of Object.entries(replacements)) {
  content = content.split(key).join(val);
}

fs.writeFileSync(file, content);
console.log('Done');

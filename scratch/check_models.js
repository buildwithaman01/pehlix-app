import fs from 'fs';
import path from 'path';

const srcDir = './src';
const modelFiles = [];

function findModelFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      findModelFiles(fullPath);
    } else if (file.endsWith('.model.js')) {
      modelFiles.push(fullPath);
    }
  }
}

findModelFiles(srcDir);

console.log(`Found ${modelFiles.length} model files.`);

for (const filepath of modelFiles) {
  const content = fs.readFileSync(filepath, 'utf8');
  const filename = path.basename(filepath);
  
  if (filename === 'lab.model.js' || filename === 'testMaster.model.js') {
    console.log(`[PASS] ${filename} (skipped - global/root entity)`);
    continue;
  }
  
  const hasLabId = content.includes('labId');
  if (!hasLabId) {
    console.log(`[FAIL] ${filename} - No labId found!`);
    continue;
  }
  
  // Check if indexed. Must either have index: true, unique: true on labId or be in a compound index.
  const hasIndex = content.includes('index: true') || 
                    content.includes('unique: true') || 
                    content.includes('index({ labId') ||
                    content.includes('index({labId') ||
                    content.includes('index({') && content.includes('labId: 1');
                    
  if (hasIndex) {
    console.log(`[PASS] ${filename} - labId is present and indexed.`);
  } else {
    console.log(`[FAIL] ${filename} - labId is present but index NOT verified!`);
  }
}

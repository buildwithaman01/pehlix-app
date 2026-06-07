const fs = require('fs');

// Patch auth.controller.js
let content = fs.readFileSync('src/modules/auth/auth.controller.js', 'utf8');
content = content.replace(/user = await User\.findOne\({ phone }\);/g, "user = await User.findOne({ phone }).populate('labId', 'name planConfig');");
content = content.replace(/user = await User\.findOne\({ email }\);/g, "user = await User.findOne({ email }).populate('labId', 'name planConfig');");
content = content.replace(/const user = await User\.findOne\({ email }\);/g, "const user = await User.findOne({ email }).populate('labId', 'name planConfig');");
fs.writeFileSync('src/modules/auth/auth.controller.js', content);

// Patch auth.service.js
let serviceContent = fs.readFileSync('src/modules/auth/auth.service.js', 'utf8');
serviceContent = serviceContent.replace(/const user = await User\.findById\(decoded\.userId\);/, "const user = await User.findById(decoded.userId).populate('labId', 'name planConfig');");
fs.writeFileSync('src/modules/auth/auth.service.js', serviceContent);

console.log('Patched correctly');

const fs = require('fs');
let content = fs.readFileSync('bot/commands/powerbase.js', 'utf8');

// Replace ephemeral({ components: [row] })
content = content.replace(/await interaction\.reply\(ephemeral\(\{ components: \[row\] \}\)\);/g, 'await interaction.reply(componentsV2Message([containerV2([textDisplayV2("Select an option below:"), row])]));');

// There is one with an embed in powerbase info... let's check what it is.
fs.writeFileSync('bot/commands/powerbase.js', content);
console.log('Done');

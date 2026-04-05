const fs = require('fs');
const rows = fs.readFileSync('master.csv', 'utf8').split('\n').filter(x => x.trim() !== '');
const head = rows[0].split(',');
console.log('Index 3:', head[3]);
console.log('Index 5:', head[5]);
console.log('Index 7:', head[7]);

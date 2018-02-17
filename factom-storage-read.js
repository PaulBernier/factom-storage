const program = require('commander');

program
    .usage('Usage: factom-storage read <chain ID>')
    .description('Read a file stored with Factom storage')
    .option('-u, --url', 'Factom node URL (e.g. http://localhost:8088/v2)')
    .parse(process.argv);
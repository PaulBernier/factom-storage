const program = require('commander');

program
    .usage('Usage: factom-storage write [options] <file> <EC address for payment>')
    .description('Write a file in Factom storage')
    .option('-m, --meta <meta>', 'Optional textual meta information about the file to be stored')
    .option('-u, --url <url>', 'Factom node URL (e.g. http://localhost:8088/v2)')
    .parse(process.argv);

console.log(program.url)
console.log(program.meta)
console.log(program.args)
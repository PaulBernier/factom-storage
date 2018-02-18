const program = require('commander'),
    colors = require('colors'),
    Promise = require('bluebird'),
    fs = Promise.promisifyAll(require('fs')),
    reader = require('./src/reader.js');

// TODO: add verbose option
program
    .usage('Usage: factom-storage download <chain ID of the file>')
    .description('Download a file stored with Factom storage')
    .option('-u, --url <url>', 'Factom node URL (e.g. http://localhost:8088/v2)')
    .parse(process.argv);

if (!program.args[0]) {
    program.outputHelp(colors.red);
    process.exit(1);
}

reader.read(program.args[0], program.url)
    .then(function (result) {
        console.log(colors.green(`File ${result.fileName} recovered from Factom blockchain!`));
        console.log(colors.green('Description:'));
        console.log(colors.green(result.fileDescription.toString()));

        return fs.writeFileAsync(result.fileName + '.factom', result.data);
    }).catch(e => console.log(colors.red(JSON.stringify(e, null, 4))));
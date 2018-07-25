const program = require('commander'),
    colors = require('colors'),
    Promise = require('bluebird'),
    log = require('winston'),
    fs = Promise.promisifyAll(require('fs')),
    { getConnectionInformation } = require('../src/util'),
    { Reader } = require('../src/reader.js');


// TODO: add verbose option
program
    .usage('[options] <chain ID of the file>')
    .description('Download a file stored with Factom storage')
    .option('-s, --socket <socket>', 'IPAddress:port of factomd API (default localhost:8088)')
    .parse(process.argv);

if (!program.args[0]) {
    program.outputHelp(colors.red);
    process.exit(1);
}

const factomdInformation = getConnectionInformation(program.socket, 8088);

(new Reader(factomdInformation)).read(program.args[0])
    .then(function(result) {
        log.info(colors.green(`File "${result.fileName}" downloaded from Factom blockchain!`));
        if (result.fileDescription) {
            log.info(colors.green('Description:'));
            log.info(colors.green(result.fileDescription.toString()));
        }

        return fs.writeFileAsync(result.fileName + '.factom', result.data);
    }).catch(e => log.error(colors.red(e instanceof Error ? e.message : JSON.stringify(e, null, 4))));
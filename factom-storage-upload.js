const program = require('commander'),
    colors = require('colors'),
    Promise = require('bluebird'),
    fs = Promise.promisifyAll(require('fs')),
    log = require('winston'),
    path = require('path'),
    writer = require('./src/writer.js');

// TODO: add verbose mode
program
    .usage('Usage: factom-storage write [options] <file> <EC address for payment>')
    .description('Write a file in Factom storage')
    .option('-m, --meta <meta>', 'Optional textual meta information about the file to be stored')
    .option('-u, --url <url>', 'Factom node URL (e.g. http://localhost:8088/v2)')
    .parse(process.argv);

if (program.args.length < 2) {
    program.outputHelp(colors.red);
    process.exit(1);
}

async function upload(filePath, ecpub, fileDesription, url) {
    const buffer = await fs.readFileAsync(filePath);
    const fileName = path.basename(filePath);
    return writer.write(fileName, buffer, ecpub, fileDesription, url)
        .then(function (result) {
            log.info(colors.green(`File ${fileName} was successfully uploaded to Factom in chain ${result.chainId}`));
            log.info(result);
        });
}

upload(program.args[0], program.args[1], program.meta, program.url)
    .catch(e => log.error(colors.red(e instanceof Error ? e.stack : JSON.stringify(e, null, 4))));
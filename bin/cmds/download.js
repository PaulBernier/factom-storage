#!/usr/bin/env node

const chalk = require('chalk'),
    Promise = require('bluebird'),
    fs = Promise.promisifyAll(require('fs')),
    { InteractiveReader } = require('../../src/read/InteractiveReader.js'),
    { getConnectionInformation } = require('../../src/util');

exports.command = 'download <chainid>';
exports.describe = 'Download a file from the Factom blockchain.';

exports.builder = function (yargs) {
    return yargs.option('socket', {
        alias: 's',
        type: 'string',
        describe: 'IPAddress:port of factomd API',
        default: 'localhost:8088'
    }).positional('chainid', {
        describe: 'Chain ID of the file to download'
    });
};

exports.handler = async function (argv) {
    console.error();
    const factomd = getConnectionInformation(argv.socket, 8088);
    const reader = new InteractiveReader({ factomd });

    return reader.read(argv.chainid).then(function (result) {
        console.error(chalk.green.bold(`\nFile "${result.filename}" successfully downloaded from Factom blockchain.`));
        console.error(chalk.blue.bold('\nPublic Key:') + ` ${result.publicKey.idpub} (raw: ${result.publicKey.raw})`);
        console.error();

        if (result.meta) {
            console.error(chalk.blue.bold('Metadata:'));
            console.error(result.meta);
            console.error();
        }

        return fs.writeFileAsync(result.filename + '.factom', result.data);
    }).catch(e => console.error(chalk.red.bold(e instanceof Error ? e.message : JSON.stringify(e, null, 4))));

};
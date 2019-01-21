#!/usr/bin/env node

const log = require('winston'),
    chalk = require('chalk'),
    Promise = require('bluebird'),
    fs = Promise.promisifyAll(require('fs')),
    { Reader } = require('../../src/reader.js'),
    { getConnectionInformation } = require('../../src/util');

exports.command = 'download <chainid>';
exports.describe = 'Download a file from the Factom blockchain.';

exports.builder = function (yargs) {
    return yargs.option('socket', {
        alias: 's',
        type: 'string',
        describe: 'IPAddress:port of factomd API.',
        default: 'localhost:8088'
    }).positional('chainid', {
        describe: 'Chain ID of the file to download.'
    });
};

exports.handler = async function (argv) {
    const factomd = getConnectionInformation(argv.socket, 8088);
    const reader = new Reader({ factomd });

    return reader.read(argv.chainid).then(function (result) {
        log.info(chalk.green(`File "${result.fileName}" downloaded from Factom blockchain!`));
        if (result.fileDescription) {
            log.info(chalk.green('Description:'));
            log.info(chalk.green(result.fileDescription.toString()));
        }

        return fs.writeFileAsync(result.fileName + '.factom', result.data);
    }).catch(e => log.error(chalk.red(e instanceof Error ? e.message : JSON.stringify(e, null, 4))));

};
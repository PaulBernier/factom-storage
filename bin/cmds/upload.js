#!/usr/bin/env node

const log = require('winston'),
    path = require('path'),
    chalk = require('chalk'),
    Promise = require('bluebird'),
    fs = Promise.promisifyAll(require('fs')),
    { InteractiveWriter } = require('../../src/write/InteractiveWriter.js'),
    { getConnectionInformation } = require('../../src/util');

exports.command = 'upload <file>';
exports.describe = 'Upload a file to the Factom blockchain.';

exports.builder = function (yargs) {
    return yargs.option('socket', {
        alias: 's',
        type: 'string',
        describe: 'IPAddress:port of factomd API.',
        default: 'localhost:8088'
    }).option('wallet', {
        alias: 'w',
        type: 'string',
        describe: 'IPAddress:port of walletd API.',
        default: 'localhost:8089'
    }).option('ecaddress', {
        alias: 'ec',
        required: true,
        type: 'string',
        describe: 'EC address to pay for the created chain and entries.',
    }).option('meta', {
        alias: 'm',
        type: 'string',
        describe: 'Textual meta information about the file to be stored',
    }).positional('file', {
        describe: 'File to upload to Factom.'
    });
};

exports.handler = async function (argv) {
    const factomd = getConnectionInformation(argv.socket, 8088);
    const walletd = getConnectionInformation(argv.wallet, 8089);
    const writer = new InteractiveWriter({ factomd, walletd });

    const file = {};
    file.content = await fs.readFileAsync(argv.file);
    file.name = path.basename(argv.file);
    file.meta = argv.meta;

    return writer.write(file, argv.ecaddress)
        .then(function (result) {
            log.info(chalk.green(`File "${file.name}" was successfully uploaded to Factom in chain ${result.chainId}`));
            log.info(result);
        })
        .catch(e => log.error(chalk.red(e instanceof Error ? e.message : JSON.stringify(e, null, 4))));

};
#!/usr/bin/env node

const ora = require('ora'),
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
        describe: 'IPAddress:port of factomd API',
        default: 'localhost:8088'
    }).option('wallet', {
        alias: 'w',
        type: 'string',
        describe: 'IPAddress:port of walletd API',
        default: 'localhost:8089'
    }).option('ecaddress', {
        alias: 'ec',
        required: true,
        type: 'string',
        describe: 'EC address to pay for the created chain and entries',
    }).option('meta', {
        alias: 'm',
        type: 'string',
        describe: 'Textual meta information about the file to be stored',
    }).positional('file', {
        describe: 'File to upload to Factom'
    });
};

exports.handler = async function (argv) {
    console.error();

    const factomd = getConnectionInformation(argv.socket, 8088);
    const walletd = getConnectionInformation(argv.wallet, 8089);
    const writer = new InteractiveWriter({ factomd, walletd });

    const file = {};
    file.content = await readFile(argv.file);
    file.name = path.basename(argv.file);
    file.meta = argv.meta;

    return writer.write(file, argv.ecaddress)
        .then(function (result) {
            console.error(chalk.green.bold(`\nFile "${file.name}" was successfully uploaded to Factom on chain ${result.chainId}.`));
            console.log(result);
            console.error();
        })
        .catch(e => console.error(chalk.red.bold(e instanceof Error ? e.message : JSON.stringify(e, null, 4))) + '\n');

};

async function readFile(file) {
    const spinner = ora('Reading file...\n').start();
    try {
        const buffer = await fs.readFileAsync(file);
        spinner.succeed();
        return buffer;
    } catch (e) {
        spinner.fail();
        console.error(chalk.red.bold(`Failed to read file: ${e.message}.\n`));
        process.exit(0);
    }
}
#!/usr/bin/env node

const program = require('commander');

program
    .description('Upload or download files to/from Factom blockchain')
    .command('download', 'Download a file stored with Factom storage').alias('d')
    .command('upload', 'Upload a file in Factom storage').alias('u')
    .parse(process.argv);
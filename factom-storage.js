const program = require('commander'),
    Promise = require('bluebird'),
    path = require('path'),
    fs = Promise.promisifyAll(require('fs')),
    writer = require('./src/writer.js'),
    reader = require('./src/reader.js');

program
    .description('Upload and download files to/from Factom blockchain')
    .command('download', 'Download a file stored with Factom storage').alias('d')
    .command('upload', 'Upload a file in Factom storage').alias('u')
    .parse(process.argv)

// const filePath = './39921282302_b8d88f89c1_m.jpg';
// const fileDescription = 'Lago di Braies - Visit my Flickr Account! https://www.flickr.com/photos/130142277@N04/';
// const ecpub = 'EC2vXWYkAPduo3oo2tPuzA44Tm7W6Cj7SeBr3fBnzswbG5rrkSTD';

// writer.write(filePath, ecpub, fileDescription)
//     .then(console.log)
//     .catch(console.error)

// reader.read('38454cbd4c465ee0b6dd6c07b180b8b2aa0a3a10a00e6ca324800e455ce4c8a3').catch(console.error)

// echo "my first entry" | factom-cli addentry -c 38454cbd4c465ee0b6dd6c07b180b8b2aa0a3a10a00e6ca324800e455ce4c8a3 EC2vXWYkAPduo3oo2tPuzA44Tm7W6Cj7SeBr3fBnzswbG5rrkSTD
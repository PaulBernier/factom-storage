const program = require('commander'),
    Promise = require('bluebird'),
    factomdjs = require('factomdjs'),
    path = require('path'),
    zlib = Promise.promisifyAll(require('zlib')),
    fs = Promise.promisifyAll(require('fs')),
    writer = require('./src/writer.js'),
    reader = require('./src/reader.js'),
    utils = require('./src/utils.js'),
    EC = require('elliptic').ec;

// program
//     .description('Read and write files from Factom blockchain')
//     .command('read', 'Read a file stored with Factom storage').alias('r')
//     .command('write', 'Write a file in Factom storage').alias('w')
//     .parse(process.argv)

const ec = new EC('ed25519');

const filePath = './39921282302_b8d88f89c1_m.jpg';
const fileDescription = 'Lago di Braies - Visit by Flickr Account! https://www.flickr.com/photos/130142277@N04/';
const ecpub = 'EC2vXWYkAPduo3oo2tPuzA44Tm7W6Cj7SeBr3fBnzswbG5rrkSTD';

// writer.write(filePath, ecpub, fileDescription)
//     .then(console.log)
//     .catch(console.error)

reader.read('f5c9943a45c84b14fa96284d239d52b09782d10de416e6759f1d2b1d51a9c30e').catch(console.error)

// factomdjs.setFactomNode('http://localhost:8088/v2');
// factomdjs.entry(0, "ce3df00a20b6aaaf14f8ff0a2c3efa854160245cf17ce9d36a8ff03090a11351")
//     .then(console.log)
//     .catch(console.error)

// fs.readFileAsync(filePath)
//     .then(f => zlib.gzipAsync(f))
//     .then(f);

// function f(buffer) {
//     const key = ec.genKeyPair();
//     const header = writer.getHeader(buffer, key, path.basename(filePath), fileDescription);

//     console.log(header);

//     // Handle parts
//     const ecCost = utils.getEcCost(header.size);
//     console.log(`EC cost: ${ecCost} (~$${ecCost * 0.001})`);

//     const parts = writer.getParts(buffer, key);

//     rebuild(header, parts);
// }

// function rebuild(header, parts) {
//     console.log('Read data');

//     const keyToVerify = ec.keyFromPublic(header.publicKey, 'hex');

//     parts.forEach(p => validate(p, keyToVerify));

//     const data = reader.getData(parts);
//     reader.validateData(header, data);

//     zlib.unzipAsync(data)
//         .then(file => fs.writeFileAsync(header.filename + '.factom', file));
// }

// function validate(part, publicKey) {
//     console.log(publicKey.verify(part.content, part.signature));
// }
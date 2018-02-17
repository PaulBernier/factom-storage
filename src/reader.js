const EC = require('elliptic').ec,
    {
        getNumberOfParts
    } = require('./utils'),
    Promise = require('bluebird'),
    fs = require('fs'),
    zlib = Promise.promisifyAll(require('zlib')),
    factom = require('../factom');

const ec = new EC('ed25519');

async function read(chainid) {
    // TODO: this should be improved to protect against spam attack
    // TODO: fetch parts that signaure match (verify parts) and stop as soon as enough parts are retrieved
    const entries = await factom.getAllEntries(chainid);
    const header = convertFirstEntryToHeader(entries[0]);
    console.log(header)
    const parts = convertEntriesToParts(entries.slice(1));
    const data = getData(parts);
    validateData(header, data);

    return zlib.unzipAsync(data)
        .then(file => fs.writeFileAsync(header.filename + '.factom', file));
}

function convertFirstEntryToHeader(entry) {
    const extids = entry.extids;
    return {
        version: parseInt(extids[0]),
        publicKey: extids[1].toString(),
        filename: extids[2],
        size: parseInt(extids[3]),
        signature: extids[4],
        fileDescription: entry.content
    }
}

function convertEntriesToParts(entries) {
    return entries.map(convertEntryToPart);
}

function convertEntryToPart(entry) {
    return {
        order: parseInt(entry.extids[0]),
        signature: entry.extids[1],
        content: entry.content
    }
}

function getData(parts) {
    const data = parts.sort((a, b) => a.order - b.order)
        .map(p => p.content);

    return Buffer.concat(data);
}

function validateData(header, data) {
    const publicKey = ec.keyFromPublic(header.publicKey, 'hex');

    if (data.length !== header.size) {
        throw "Data length doesn't match the size of the original file";
    }
    if (!publicKey.verify(data, header.signature)) {
        throw "Data signature doesn't match the signature of the original file";
    }
}

module.exports = {
    read
}
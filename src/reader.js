const EC = require('elliptic').ec,
    Promise = require('bluebird'),
    zlib = Promise.promisifyAll(require('zlib')),
    factom = require('../factom');

const ec = new EC('ed25519');

// TODO: check config of factom node (responding)
async function read(chainid, url) {
    if (url) {
        factom.setFactomNode(url);
    }

    console.log(`Retrieving data from chain ${chainid}...`);
    const entries = await factom.getAllEntriesOfChain(chainid);

    console.log('Rebuilding file...');
    const header = convertFirstEntryToHeader(entries[0]);
    const parts = convertEntriesToParts(entries.slice(1), header.publicKey);
    const zippedData = getData(parts);
    validateData(header, zippedData);

    return zlib.unzipAsync(zippedData)
        .then(data => ({
            fileName: header.filename.toString(),
            fileDescription: header.fileDescription.toString(),
            data: data,
        }));
}

function convertFirstEntryToHeader(entry) {
    const extids = entry.extids;
    if (extids.length === 0 || extids[0].toString() !== 'factom-storage') {
        throw 'First entry of the chain is not a file header entry';
    }

    return {
        version: parseInt(extids[1]),
        publicKeyEncoded: extids[2],
        filename: extids[3],
        size: parseInt(extids[4]),
        signature: extids[5],
        fileDescription: entry.content,
        publicKey: ec.keyFromPublic(extids[2].toString('hex'), 'hex')
    };
}

function convertEntriesToParts(entries, publicKey) {
    const validEntries = getValidPartEntries(entries, publicKey);

    if (validEntries.length !== entries.length) {
        console.log(`${entries.length - validEntries.length} invalid entries discarded`);
    }

    return validEntries.map(convertEntryToPart);
}

function getValidPartEntries(entries, publicKey) {
    return entries.filter(function(entry) {
        if (entry.extids.length < 2) {
            return false;
        }

        return publicKey.verify(entry.content, entry.extids[1]);
    });
}

function convertEntryToPart(entry) {
    return {
        order: entry.extids[0].readInt32BE(),
        signature: entry.extids[1],
        content: entry.content
    };
}

function getData(parts) {
    const data = parts.sort((a, b) => a.order - b.order)
        .map(p => p.content);

    return Buffer.concat(data);
}

function validateData(header, data) {

    if (data.length !== header.size) {
        throw 'Data length doesn\'t match the size of the original file';
    }
    if (!header.publicKey.verify(data, header.signature)) {
        throw 'Data signature doesn\'t match the signature of the original file';
    }
}

module.exports = {
    read
}
const EdDSA = require('elliptic').eddsa,
    Promise = require('bluebird'),
    zlib = Promise.promisifyAll(require('zlib')),
    log = require('winston'),
    // TODO: package
    factom = require('../../factomjs/factom');

const ec = new EdDSA('ed25519');

async function read(chainId, url) {
    if (url) {
        factom.setFactomNode(url);
    }
    await factom.properties().catch(e => {
        throw 'Failed to reach the Factom Node: ' + e;
    });

    log.info(`Retrieving data from chain ${chainId}...`);
    const entries = await getEntries(chainId);

    log.info('Rebuilding file...');
    const header = convertFirstEntryToHeader(entries[0]);
    const parts = convertEntriesToParts(entries.slice(1), header.key, header.fileHash);
    const zippedData = getData(parts);
    validateData(header, zippedData);

    return zlib.unzipAsync(zippedData)
        .then(data => ({
            fileName: header.filename.toString(),
            fileDescription: header.fileDescription.toString(),
            data: data,
        }));
}

function getEntries(chainId) {
    return factom.getAllEntriesOfChain(chainId).catch(e => {
        throw 'Failed to download the data from the blockchain. If you recently uploaded your file it may take some time before it gets actually persisted. Otherwise please verify the chain id you provided is correct. ' +
            JSON.stringify(e);
    });
}

function convertFirstEntryToHeader(entry) {
    const extIds = entry.extIds;
    if (extIds.length === 0 || extIds[0].toString() !== 'factom-storage') {
        throw 'First entry of the chain is not a file header entry';
    }

    return {
        version: parseInt(extIds[1]),
        publicKey: extIds[2],
        filename: extIds[3],
        size: parseInt(extIds[4]),
        fileHash: extIds[5],
        signature: extIds[6],
        fileDescription: entry.content,
        key: ec.keyFromPublic([...extIds[2]])
    };
}

function convertEntriesToParts(entries, key, fileHash) {
    const validEntries = getValidPartEntries(entries, key, fileHash);

    if (validEntries.length !== entries.length) {
        log.warn(`${entries.length - validEntries.length} invalid entries discarded`);
    }

    return validEntries.map(convertEntryToPart);
}

function getValidPartEntries(entries, key, fileHash) {
    return entries.filter(function (entry) {
        if (entry.extIds.length < 2) {
            return false;
        }

        return key.verify(Buffer.concat([entry.content, fileHash]), [...entry.extIds[1]]);
    });
}

function convertEntryToPart(entry) {
    return {
        order: entry.extIds[0].readInt32BE(),
        signature: entry.extIds[1],
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
    if (!header.key.verify(Buffer.concat([data, header.fileHash]), [...header.signature])) {
        throw 'Data signature doesn\'t match the signature of the original file';
    }
}

module.exports = {
    read
};
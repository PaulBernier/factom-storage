const EC = require('elliptic').ec,
    { getNumberOfParts } = require('./utils'),
    factomdjs = require('factomdjs');

const ec = new EC('ed25519');

function read(chainId, url) {
    const {
        header,
        parts
    } = readPartsFromChain(chainId);

    const data = getData(parts);
    validate(data, header);

    return {
        filename: header.filename,
        data: data
    };
}

function readPartsFromChain(chaindId) {
    // Read header
    const header = {};
    // Iterate over the entries of the chain
    // For each verify the signature, if it's valide, take it
    const nbOfParts = getNumberOfParts(header.size);
}

function getData(parts) {
    const dataHex = parts.sort((a, b) => a.order - b.order)
        .map(p => p.content)
        .join('');

    return Buffer.from(dataHex, 'hex');
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
    read,
    readPartsFromChain,
    getData,
    validateData
}
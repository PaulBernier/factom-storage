const EC = require('elliptic').ec,
    { MAX_PARTS_CONTENT_BYTE_SIZE, getNumberOfParts } = require('./utils'),
    factomdjs = require('factomdjs');

const ec = new EC('ed25519');

function getHeader(buffer, key, fileName, fileDescription) {
    const size = buffer.length;
    const publicKey = key.getPublic().encode('hex');
    const signature = Buffer.from(key.sign(buffer).toDER()).toString('hex');

    return {
        version: 1,
        filename: fileName,
        publicKey: publicKey,
        size: size,
        signature: signature,
        fileDescription: fileDescription
    }
}

function getParts(buffer, key) {
    const partsNumber = getNumberOfParts(buffer.length);
    console.log(partsNumber);

    const parts = [];
    for (let i = 0; i < partsNumber; ++i) {
        parts.push(getPart(buffer, i, key));
    }

    return parts;
}

function getPart(buffer, i, key) {
    const part = buffer.slice(i * MAX_PARTS_CONTENT_BYTE_SIZE, Math.min(MAX_PARTS_CONTENT_BYTE_SIZE * (i + 1), buffer.length));

    const signature = Buffer.from(key.sign(part).toDER()).toString('hex');
    const content = part.toString('hex');

    return {
        content: content,
        signature: signature,
        order: i
    }
}

module.exports = {
    getHeader,
    getParts
}
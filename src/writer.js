const EC = require('elliptic').ec,
    {
        MAX_PARTS_CONTENT_BYTE_SIZE,
        getNumberOfParts,
        getEcCost
    } = require('./utils'),
    Promise = require('bluebird'),
    fs = require('fs'),
    path = require('path'),
    zlib = Promise.promisifyAll(require('zlib')),
    factom = require('../factom');

const ec = new EC('ed25519');

async function write(filepath, ecpub, fileDescription) {
    const key = ec.genKeyPair();
    const buffer = await fs.readFileAsync(filepath).then(f => zlib.gzipAsync(f));
    const header = getHeader(buffer, key, path.basename(filepath), fileDescription);
    const parts = getParts(buffer, key);

    console.log(header);
    const ecCost = getEcCost(header.size);
    console.log(`EC cost: ${ecCost} (~$${ecCost * 0.001})`);

    return persist(header, parts, ecpub);
}

function getHeader(buffer, key, fileName, fileDescription) {
    const size = buffer.length;
    // TODO: not store as HEX string to save space?
    const publicKey = key.getPublic().encode('hex');
    const signature = Buffer.from(key.sign(buffer).toDER());

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
    console.log(partsNumber + ' parts');

    const parts = [];
    for (let i = 0; i < partsNumber; ++i) {
        parts.push(getPart(buffer, i, key));
    }

    return parts;
}

function getPart(buffer, i, key) {
    const content = buffer.slice(i * MAX_PARTS_CONTENT_BYTE_SIZE, Math.min(MAX_PARTS_CONTENT_BYTE_SIZE * (i + 1), buffer.length));
    const signature = Buffer.from(key.sign(content).toDER());

    return {
        content: content,
        signature: signature,
        order: i
    }
}

async function persist(header, parts, ecpub) {

    const {chainid, entryhash} = await createFileChain(header, ecpub);
    await factom.waitOnRevealAck(entryhash, chainid, 10);
    await persistParts(chainid, parts, ecpub);

    return chainid;
}

function createFileChain(header, ecpub) {
    console.log("Creating file chain...", ecpub)
    return factom.addChain(convertHeaderToChain(header),
        ecpub
    )
}

function convertHeaderToChain(header) {
    return {
        // TODO: replace Math.random()
        extids: [header.version.toString(), header.publicKey, header.filename, header.size.toString(), header.signature, Math.random().toString()],
        content: header.fileDescription
    };
}

function persistParts(chainid, parts, ecpub) {
    console.log("Persisting parts...");
    const entries = convertPartsToEntries(chainid, parts);
    return factom.addEntries(entries, ecpub);
}

function convertPartsToEntries(chainid, parts) {
    return parts.map(convertPartToEntry.bind(null, chainid));
}

function convertPartToEntry(chainid, part) {
    return {
        chainid: chainid,
        extids: [part.order.toString(), part.signature],
        content: part.content
    }
}

module.exports = {
    write
}
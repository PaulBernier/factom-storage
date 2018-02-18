const EC = require('elliptic').ec,
    Promise = require('bluebird'),
    fs = require('fs'),
    path = require('path'),
    zlib = Promise.promisifyAll(require('zlib')),
    factom = require('../factom');

// 35 (mandatory entry header) + 4 (size of extID) + 4 (part order) + 70 (part signature) 
const HEADER_SIZE = 35 + 2 * 2 + 4 + 70;
const MAX_PARTS_CONTENT_BYTE_SIZE = 10275 - HEADER_SIZE;
const ec = new EC('ed25519');

// TODO: check config of factom node and wallet (responding)
async function write(fileName, data, ecpub, fileDescription, url) {
    if (url) {
        factom.setFactomNode(url);
    }


    const key = ec.genKeyPair();
    const buffer = await zlib.gzipAsync(data);
    const header = getHeader(buffer, key, fileName, fileDescription);
    const parts = getParts(buffer, key);

    console.log(header);

    const chainid = await persist(header, parts, ecpub);

    return {
        chainid: chainid,
        privateKey: key.getPublic().encode('hex')
    };
}

function getHeader(buffer, key, fileName, fileDescription) {
    const size = buffer.length;

    const publicKeyEncoded = Buffer.from(key.getPublic().encode());
    const signature = Buffer.from(key.sign(buffer).toDER());

    return {
        version: 1,
        filename: fileName,
        publicKeyEncoded: publicKeyEncoded,
        size: size,
        signature: signature,
        fileDescription: fileDescription
    };
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
    };
}

function getNumberOfParts(size) {
    return Math.ceil(size / MAX_PARTS_CONTENT_BYTE_SIZE);
}

async function persist(header, parts, ecpub) {

    const firstEntry = convertHeaderToFirstEntry(header);
    const entries = convertPartsToEntries(parts);
    const cost = entries.reduce((acc, entry) => acc + factom.entryCost(entry), factom.chainCost(firstEntry));
    console.log(`EC cost: ${cost} (~$${cost * 0.001})`);

    const {
        chainid,
        entryhash
    } = await createFileChain(firstEntry, ecpub);
    await waitOnChainCreation(entryhash, chainid);
    await persistParts(chainid, entries, ecpub);

    return chainid;
}

async function waitOnChainCreation(entryhash, chainid) {
    console.log('Waiting confirmation of chain creation');
    await factom.waitOnRevealAck(entryhash, chainid, 60);
    console.log('Chain created');
}

function createFileChain(firstEntry, ecpub) {
    console.log('Creating file chain...');
    return factom.addChain(firstEntry, ecpub);
}

function convertHeaderToFirstEntry(header) {
    return {
        extids: ['factom-storage', header.version.toString(), header.publicKeyEncoded, header.filename, header.size.toString(), header.signature],
        content: header.fileDescription
    };
}

function persistParts(chainid, entries, ecpub) {
    console.log('Persisting parts...');
    entries.forEach(entry => entry.chainid = chainid);
    return factom.addEntries(entries, ecpub);
}

function convertPartsToEntries(parts) {
    return parts.map(convertPartToEntry);
}

function convertPartToEntry(part) {
    const orderBuffer = Buffer.alloc(4);
    orderBuffer.writeInt32BE(part.order);
    const entry = {
        extids: [orderBuffer, part.signature],
        content: part.content
    };

    return entry;
}

module.exports = {
    write
}
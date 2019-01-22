const { Entry, Chain } = require('factom'),
    hashSha512 = require('hash.js/lib/hash/sha/512'),
    Promise = require('bluebird'),
    zlib = Promise.promisifyAll(require('zlib')),
    identity = require('factom-identity-lib').digital,
    sign = require('tweetnacl/nacl-fast').sign;

// 4 (size of extID) + 4 (part order) + 64 (part signature) 
const PARTS_HEADER_SIZE = 2 * 2 + 4 + 64;
const MAX_PARTS_CONTENT_BYTE_SIZE = 10240 - PARTS_HEADER_SIZE;
const CURRENT_VERSION = '1';

async function getChainAndEntries(file, secret) {
    validateFile(file);

    const key = sign.keyPair.fromSeed(getSeed(secret));
    const buffer = await zlib.gzipAsync(file.content);
    const chain = getChain(buffer, file, key);
    const entries = getEntries(buffer, chain.id, key);

    return { chain, entries };
}

function getSeed(secret) {
    if (identity.isValidSecretIdentityKey(secret)) {
        return identity.extractCryptoMaterial(secret);
    } else {
        return Buffer.from(secret, 'hex');
    }
}

function validateFile(file) {
    if (!Buffer.isBuffer(file.content)) {
        throw new Error('File content must be a Buffer.');
    }
    if (!file.name) {
        throw new Error('A file name must be provided.');
    }
}

function getChain(buffer, file, key) {
    const size = buffer.length;
    const fileHash = sha512(buffer);
    const publicKey = Buffer.from(key.publicKey);
    const signature = Buffer.from(sign.detached(buffer, key.secretKey));

    const entry = Entry.builder()
        .extId('factom-storage', 'utf8')
        .extId(CURRENT_VERSION, 'utf8')
        .extId(publicKey)
        .extId(file.name, 'utf8')
        .extId(size.toString(), 'utf8')
        .extId(fileHash)
        .extId(signature)
        .content(file.meta, 'utf8')
        .build();

    return new Chain(entry);
}

function getEntries(buffer, chainId, key) {
    const partsNumber = getNumberOfParts(buffer.length);

    const entries = [];
    for (let i = 0; i < partsNumber; ++i) {
        entries.push(getEntry(buffer, i, chainId, key));
    }

    return entries;
}

function getEntry(buffer, order, chainId, key) {
    const orderBuffer = Buffer.alloc(4);
    orderBuffer.writeInt32BE(order);
    const content = buffer.slice(order * MAX_PARTS_CONTENT_BYTE_SIZE, Math.min(MAX_PARTS_CONTENT_BYTE_SIZE * (order + 1), buffer.length));
    const signature = Buffer.from(sign.detached(Buffer.concat([orderBuffer, content, chainId]), key.secretKey));

    return Entry.builder()
        .chainId(chainId)
        .extId(orderBuffer)
        .extId(signature)
        .content(content)
        .build();
}

function getNumberOfParts(size) {
    return Math.ceil(size / MAX_PARTS_CONTENT_BYTE_SIZE);
}

function sha512(data) {
    return Buffer.from(hashSha512().update(data).digest());
}

module.exports = {
    getChainAndEntries
};
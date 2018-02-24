const crypto = require('crypto'),
    EdDSA = require('elliptic').eddsa,
    Promise = require('bluebird'),
    prompt = require('prompt'),
    log = require('winston'),
    zlib = Promise.promisifyAll(require('zlib')),
    fctUtils = require('factomjs-util'),
    // TODO: package
    factom = require('../../factomjs/factom.js');

// 35 (mandatory entry header) + 4 (size of extID) + 4 (part order) + 64 (part signature) 
const HEADER_SIZE = 35 + 2 * 2 + 4 + 64;
const MAX_PARTS_CONTENT_BYTE_SIZE = 10275 - HEADER_SIZE;
const ec = new EdDSA('ed25519');

// TODO: private key should be input here. If absent, use the private EC key?
async function write(fileName, data, ecAddress, fileDescription, url) {
    if (url) {
        factom.setFactomNode(url);
    }
    validateRequest(ecAddress);

    const secret = crypto.randomBytes(32);
    const key = ec.keyFromSecret(secret);

    const buffer = await zlib.gzipAsync(data);
    const header = getHeader(buffer, key, fileName, fileDescription);
    const parts = getParts(buffer, key, header.fileHash);

    log.debug(header);

    const chainId = await persist(header, parts, ecAddress);

    return {
        chainId: chainId,
        privateKey: secret.toString('hex')
    };
}

async function validateRequest(ecAddress) {
    if (!fctUtils.isValidAddress(ecAddress) || !['EC', 'Es'].includes(ecAddress.substring(0, 2))) {
        throw `${ecAddress} is not a valid EC address`;
    }
    await factom.properties().catch(e => {
        throw 'Failed to reach the Factom Node: ' + e;
    });
}

function getHeader(buffer, key, fileName, fileDescription) {
    const size = buffer.length;

    const fileHash = sha512(buffer);
    const publicKey = Buffer.from(key.getPublic());
    const signature = Buffer.from(key.sign(Buffer.concat([buffer, fileHash])).toBytes());

    return {
        version: 1,
        filename: fileName,
        publicKey: publicKey,
        fileHash: fileHash,
        size: size,
        signature: signature,
        fileDescription: fileDescription
    };
}

function getParts(buffer, key, fileHash) {
    const partsNumber = getNumberOfParts(buffer.length);
    log.debug(partsNumber + ' parts');

    const parts = [];
    for (let i = 0; i < partsNumber; ++i) {
        parts.push(getPart(buffer, i, key, fileHash));
    }

    return parts;
}

function getPart(buffer, i, key, fileHash) {
    const content = buffer.slice(i * MAX_PARTS_CONTENT_BYTE_SIZE, Math.min(MAX_PARTS_CONTENT_BYTE_SIZE * (i + 1), buffer.length));
    const signature = Buffer.from(key.sign(Buffer.concat([content, fileHash])).toBytes());

    return {
        content: content,
        signature: signature,
        order: i
    };
}

function getNumberOfParts(size) {
    return Math.ceil(size / MAX_PARTS_CONTENT_BYTE_SIZE);
}

function getHumanReadableECPublicKey(ecPrivate) {
    const secret = fctUtils.privateHumanAddressStringToPrivate(ecPrivate);
    const key = ec.keyFromSecret(secret);  
    return fctUtils.publicECKeyToHumanAddress(Buffer.from(key.getPublic()));
}

async function persist(header, parts, ecAddress) {

    const firstEntry = convertHeaderToFirstEntry(header);
    const entries = convertPartsToEntries(parts);
    const cost = entries.reduce((acc, entry) => acc + factom.entryCost(entry), factom.chainCost(firstEntry));

    const publicKey = ecAddress.substring(0, 2) === 'EC' ? ecAddress : getHumanReadableECPublicKey(ecAddress);

    const availableBalance = await factom.getBalance(publicKey);

    if (cost > availableBalance) {
        throw `EC cost to persist: ${cost}. Available balance (${availableBalance}) of address ${ecAddress} is not enough.`;
    }

    log.info(`EC cost: ${cost} (~$${cost * 0.001}) (available balance: ${availableBalance})`);

    const confirmation = await getPromptConfirmation();
    if (!confirmation) {
        process.exit(0);
    }
    const {
        chainId,
        entryHash
    } = await createFileChain(firstEntry, ecAddress);

    await waitOnChainCreation(entryHash, chainId);
    await persistParts(chainId, entries, ecAddress);

    return chainId;
}

async function getPromptConfirmation() {
    prompt.start();

    const promptResult = await Promise.promisify(prompt.get)({
        name: 'confirmation',
        type: 'string',
        pattern: /^(yes|y|n|no)$/,
        description: 'Confirm you want to upload? (yes/no)',
        required: true
    }).catch(function (e) {
        if (e instanceof Error && e.message === 'canceled') {
            process.stdout.write('\n');
            process.exit(0);
        } else {
            throw e;
        }
    });

    return ['yes', 'y'].includes(promptResult.confirmation);
}

async function waitOnChainCreation(entryhash, chainId) {
    log.info('Waiting confirmation of chain creation');
    await factom.waitOnRevealAck(entryhash, chainId, 120);
    log.info('Chain created');
}

function createFileChain(firstEntry, ecAddress) {
    log.info('Creating file chain...');
    return factom.addChain(firstEntry, ecAddress);
}

function convertHeaderToFirstEntry(header) {
    return {
        extIds: [
            'factom-storage',
            header.version.toString(),
            header.publicKey,
            header.filename,
            header.size.toString(),
            header.fileHash,
            header.signature
        ],
        content: header.fileDescription
    };
}

function persistParts(chainId, entries, ecpub) {
    log.info('Persisting parts...');
    entries.forEach(entry => entry.chainId = chainId);
    return factom.addEntries(entries, ecpub);
}

function convertPartsToEntries(parts) {
    return parts.map(convertPartToEntry);
}

function convertPartToEntry(part) {
    const orderBuffer = Buffer.alloc(4);
    orderBuffer.writeInt32BE(part.order);
    const entry = {
        extIds: [orderBuffer, part.signature],
        content: part.content
    };

    return entry;
}

function sha512(data) {
    const hash = crypto.createHash('sha512');
    hash.update(data);
    return hash.digest();
}

module.exports = {
    write
};
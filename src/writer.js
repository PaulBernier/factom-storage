const crypto = require('crypto'),
    EdDSA = require('elliptic').eddsa,
    Promise = require('bluebird'),
    prompt = require('prompt'),
    log = require('winston'),
    zlib = Promise.promisifyAll(require('zlib')),
    fctUtils = require('factomjs-util'),
    // TODO: package
    factom = require('../../factomjs');

const {
    Entry,
    Chain,
    FactomCli,
    entryCost,
    chainCost
} = factom;

// 35 (mandatory entry header) + 4 (size of extID) + 4 (part order) + 64 (part signature) 
const HEADER_SIZE = 35 + 2 * 2 + 4 + 64;
const MAX_PARTS_CONTENT_BYTE_SIZE = 10275 - HEADER_SIZE;
const ec = new EdDSA('ed25519');

class Writer {
    constructor(opt) {
        this.fctCli = new FactomCli(opt);
    }

    // TODO: private key should be input here. If absent, use the private EC key?
    async write(fileName, data, ecAddress, fileDescription) {
        validateRequest(this.fctCli, ecAddress);

        const secret = crypto.randomBytes(32);
        const key = ec.keyFromSecret(secret);

        const {
            header,
            parts
        } = await getHeaderAndParts(fileName, data, key, fileDescription);

        log.debug(header);

        const chainId = await persist(this.fctCli, header, parts, ecAddress);

        return {
            chainId: chainId,
            privateKey: secret.toString('hex')
        };
    }
}

async function validateRequest(fctCli, ecAddress) {
    if (!fctUtils.isValidAddress(ecAddress) || !['EC', 'Es'].includes(ecAddress.substring(0, 2))) {
        throw `${ecAddress} is not a valid EC address`;
    }
    await fctCli.getProperties().catch(e => {
        throw 'Failed to reach the Factom Node: ' + e;
    });
}

async function getHeaderAndParts(fileName, data, key, fileDescription) {
    const buffer = await zlib.gzipAsync(data);
    const header = getHeader(buffer, key, fileName, fileDescription);
    const parts = getParts(buffer, key, header.fileHash);

    return {
        header,
        parts
    };
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

async function persist(fctCli, header, parts, ecAddress) {

    const chain = new Chain(convertHeaderToFirstEntry(header));
    const entries = convertPartsToEntries(parts, chain.chainId);
    const cost = entries.reduce((acc, entry) => acc + entryCost(entry), chainCost(chain));

    // TODO: this logic will be moved inside getBalance library
    const publicKey = ecAddress.substring(0, 2) === 'EC' ? ecAddress : getHumanReadableECPublicKey(ecAddress);

    const availableBalance = await fctCli.getBalance(publicKey);

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
    } = await createFileChain(fctCli, chain, ecAddress);

    await waitOnChainCreation(fctCli, entryHash, chainId);
    await persistParts(fctCli, entries, ecAddress);

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

function createFileChain(fctCli, chain, ecAddress) {
    log.info('Creating file chain...');

    return fctCli.addChain(chain, ecAddress);
}

async function waitOnChainCreation(fctCli, entryHash, chainId) {
    log.info('Waiting confirmation of chain creation');
    await fctCli.waitOnRevealAck(entryHash, chainId, 120);
    log.info('Chain created');
}

function convertHeaderToFirstEntry(header) {
    return new Entry.Builder()
        .extId('factom-storage')
        // TODO: optimize to int buffer
        .extId(header.version.toString())
        .extId(header.publicKey)
        .extId(header.filename)
        .extId(header.size.toString())
        .extId(header.fileHash)
        .extId(header.signature)
        .content(header.fileDescription)
        .build();
}

function persistParts(fctCli, entries, ecpub) {
    log.info('Persisting parts...');
    return fctCli.addEntries(entries, ecpub);
}

function convertPartsToEntries(parts, chainId) {
    return parts.map(part => convertPartToEntry(part, chainId));
}

function convertPartToEntry(part, chainId) {
    const orderBuffer = Buffer.alloc(4);
    orderBuffer.writeInt32BE(part.order);

    return new Entry.Builder()
        .chainId(chainId)
        .extId(orderBuffer)
        .extId(part.signature)
        .content(part.content)
        .build();
}

function sha512(data) {
    const hash = crypto.createHash('sha512');
    hash.update(data);
    return hash.digest();
}

module.exports = {
    Writer
};
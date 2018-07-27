const crypto = require('crypto'),
    EdDSA = require('elliptic').eddsa,
    Promise = require('bluebird'),
    prompt = require('prompt'),
    log = require('winston'),
    zlib = Promise.promisifyAll(require('zlib'));

const {
    Entry,
    Chain,
    FactomCli,
    getPublicAddress,
    isValidAddress
} = require('factom');

// 35 (mandatory entry header) + 4 (size of extID) + 4 (part order) + 64 (part signature) 
const HEADER_SIZE = 35 + 2 * 2 + 4 + 64;
const MAX_PARTS_CONTENT_BYTE_SIZE = 10275 - HEADER_SIZE;
const ec = new EdDSA('ed25519');

class Writer {
    constructor(opt) {
        this.fctCli = new FactomCli(opt);
    }

    async write(fileName, data, ecAddress, fileDescription) {
        await validateRequest(this.fctCli, ecAddress);

        const secret = crypto.randomBytes(32);
        const key = ec.keyFromSecret(secret);

        const { header, parts } = await getHeaderAndParts(fileName, data, key, fileDescription);

        log.debug(header);

        const chainId = await persist(this.fctCli, header, parts, ecAddress);

        return {
            chainId: chainId,
            privateKey: secret.toString('hex')
        };
    }
}

async function validateRequest(fctCli, ecAddress) {
    if (!isValidAddress(ecAddress) || !['EC', 'Es'].includes(ecAddress.substring(0, 2))) {
        throw new Error(`${ecAddress} is not a valid EC address`);
    }
    await fctCli.getNodeProperties().catch(e => {
        throw new Error(`Failed to reach the Factom Node: ${e}`);
    });
}

async function getHeaderAndParts(fileName, data, key, fileDescription) {
    log.info('Preparing and signing file for upload...');

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

async function persist(fctCli, header, parts, ecAddress) {

    const chain = new Chain(convertHeaderToFirstEntry(header));
    const entries = convertPartsToEntries(parts, chain.id);
    const cost = entries.reduce((acc, entry) => acc + entry.ecCost(), chain.ecCost());

    const publicAddress = getPublicAddress(ecAddress);
    const availableBalance = await fctCli.getBalance(publicAddress);

    if (cost > availableBalance) {
        throw new Error(`EC cost to persist: ${cost.toLocaleString()}. Available balance (${availableBalance.toLocaleString()}) of address ${publicAddress} is not enough.`);
    }

    log.info(`EC cost: ${cost.toLocaleString()} (~$${cost * 0.001}) (available balance: ${availableBalance.toLocaleString()})`);

    const confirmation = await getPromptConfirmation();
    if (!confirmation) {
        process.exit(0);
    }

    await createFileChain(fctCli, chain, ecAddress);
    await persistParts(fctCli, entries, ecAddress);

    return chain.id.toString('hex');
}

async function getPromptConfirmation() {
    prompt.start();

    const promptResult = await Promise.promisify(prompt.get)({
        name: 'confirmation',
        type: 'string',
        pattern: /^(yes|y|n|no)$/,
        description: 'Confirm you want to upload? (yes/no)',
        required: true
    }).catch(function(e) {
        if (e instanceof Error && e.message === 'canceled') {
            process.stdout.write('\n');
            process.exit(0);
        } else {
            throw e;
        }
    });

    return ['yes', 'y'].includes(promptResult.confirmation);
}

async function createFileChain(fctCli, chain, ecAddress) {
    log.info(`Creating file chain [${chain.id.toString('hex')}]...`);
    await fctCli.add(chain, ecAddress, { commitTimeout: -1, revealTimeout: -1 });
    log.info('Chain of the file created');
}

function convertHeaderToFirstEntry(header) {
    return Entry.builder()
        .extId('factom-storage', 'utf8')
        .extId(header.version.toString(), 'utf8')
        .extId(header.publicKey, 'utf8')
        .extId(header.filename, 'utf8')
        .extId(header.size.toString(), 'utf8')
        .extId(header.fileHash, 'utf8')
        .extId(header.signature, 'utf8')
        .content(header.fileDescription, 'utf8')
        .build();
}

function persistParts(fctCli, entries, ecpub) {
    log.info('Persisting parts...');
    return fctCli.add(entries, ecpub, { commitTimeout: -1, revealTimeout: -1 });
}

function convertPartsToEntries(parts, chainId) {
    return parts.map(part => convertPartToEntry(part, chainId));
}

function convertPartToEntry(part, chainId) {
    const orderBuffer = Buffer.alloc(4);
    orderBuffer.writeInt32BE(part.order);

    return Entry.builder()
        .chainId(chainId)
        .extId(orderBuffer, 'utf8')
        .extId(part.signature, 'utf8')
        .content(part.content, 'utf8')
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
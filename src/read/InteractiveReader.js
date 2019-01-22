const sign = require('tweetnacl/nacl-fast').sign,
    Promise = require('bluebird'),
    zlib = Promise.promisifyAll(require('zlib')),
    ora = require('ora'),
    chalk = require('chalk'),
    uniqBy = require('lodash.uniqby'),
    { keyToPublicIdentityKey } = require('factom-identity-lib').digital,
    { FactomCli } = require('factom');

class InteractiveReader {
    constructor(opt) {
        this.fctCli = new FactomCli(opt);
    }

    async read(chainId) {

        const entries = await getEntries(this.fctCli, chainId);
        const { zippedData, filename, meta, publicKey } = rebuildZippedFile(entries, chainId);

        return zlib.unzipAsync(zippedData)
            .then(data => ({
                filename,
                meta,
                data: data,
                publicKey: { raw: publicKey.toString('hex'), idpub: keyToPublicIdentityKey(publicKey) }
            }));
    }
}

async function getEntries(fctCli, chainId) {
    const spinner = ora(`Retrieving data from chain ${chalk.yellow(chainId)}...`).start();

    try {
        const entries = await fctCli.getAllEntriesOfChain(chainId);
        spinner.succeed();
        return entries;
    } catch (e) {
        spinner.fail();
        throw new Error(`Failed to download the data from the blockchain. If you recently uploaded your file it may take some time before it gets actually persisted. Otherwise please verify the chain id you provided is correct. [${e.message}]`);
    }
}

function rebuildZippedFile(entries, chainId) {
    const spinner = ora('Rebuilding file...').start();

    try {
        const header = convertFirstEntryToHeader(entries[0]);
        const parts = convertEntriesToParts(entries.slice(1), header.publicKey, Buffer.from(chainId, 'hex'));
        const zippedData = getData(parts);
        validateData(header, zippedData);
        spinner.succeed();

        return {
            zippedData,
            filename: header.filename.toString(),
            meta: header.meta.toString(),
            publicKey: header.publicKey
        };
    } catch (e) {
        spinner.fail();
        throw e;
    }
}

function convertFirstEntryToHeader(entry) {
    const extIds = entry.extIds;
    if (extIds.length === 0 || extIds[0].toString() !== 'factom-storage') {
        throw new Error('First entry of the chain is not a file header entry');
    }

    return {
        version: parseInt(extIds[1]),
        publicKey: extIds[2],
        filename: extIds[3],
        size: parseInt(extIds[4]),
        fileHash: extIds[5],
        signature: extIds[6],
        meta: entry.content
    };
}

function convertEntriesToParts(entries, publicKey, chainId) {
    const validEntries = getValidPartEntries(entries, publicKey, chainId);
    return validEntries.map(convertEntryToPart);
}

function getValidPartEntries(entries, publicKey, chainId) {
    return entries.filter(function (entry) {
        if (entry.extIds.length < 2) {
            return false;
        }

        return sign.detached.verify(Buffer.concat([entry.extIds[0], entry.content, chainId]), entry.extIds[1], publicKey);
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
    const uniqueParts = uniqBy(parts, p => p.order);
    const data = uniqueParts.sort((a, b) => a.order - b.order)
        .map(p => p.content);

    return Buffer.concat(data);
}

function validateData(header, data) {

    if (data.length !== header.size) {
        throw new Error('Data length doesn\'t match the size of the original file');
    }
    if (!sign.detached.verify(data, header.signature, header.publicKey)) {
        throw new Error('Data signature doesn\'t match the signature of the original file');
    }
}

module.exports = {
    InteractiveReader
};
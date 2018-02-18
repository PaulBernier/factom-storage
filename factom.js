const factomdjs = require('../factomdjs/src/factomd'),
    walletd = require('../factom-walletdjs/src/factom-walletd'),
    Promise = require('bluebird'),
    crypto = require('crypto');

// TODO: uniformize chainid, chainId, extids, extIds

const NULL_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

function setFactomNode(url) {
    factomdjs.setFactomNode(url);
}

function setFactomWallet(url) {
    walletd.setFactomNode(url);
}

async function getAllEntriesOfChain(chainId) {
    const allEntries = [];
    const chainHead = await factomdjs.chainHead(chainId);

    let keymr = chainHead.chainhead;
    while (keymr !== NULL_HASH) {
        const {
            entries,
            prevkeymr
        } = await getAllEntriesOfEntryBlock(keymr);
        allEntries.push(...entries.reverse());

        keymr = prevkeymr;
    }

    return Promise.resolve(allEntries.reverse());
}

async function getFirstEntry(chainId) {
    const chainHead = await factomdjs.chainHead(chainId);
    let keymr = chainHead.chainhead;
    let entryBlock;
    while (keymr !== NULL_HASH) {
        entryBlock = await factomdjs.entryBlock(keymr);
        keymr = entryBlock.header.prevkeymr;
    }

    return factomdjs.entry(entryBlock.entrylist[0].entryhash)
        .then(decodeEntry);
}

function getChainHead(chainId) {
    return factomdjs.chainHead(chainId);
}

async function getAllEntriesOfEntryBlock(keymr) {
    const entryBlock = await factomdjs.entryBlock(keymr);

    const entries = await Promise.map(entryBlock.entrylist.map(e => e.entryhash), factomdjs.entry);

    return {
        entries: entries.map(decodeEntry),
        prevkeymr: entryBlock.header.prevkeymr
    }
}

function decodeEntry(entry) {
    entry.content = entry.content ? Buffer.from(entry.content, 'hex') : Buffer.from('');
    entry.extids = Array.isArray(entry.extids) ? entry.extids.map(extid => Buffer.from(extid, 'hex')) : [];

    return entry;
}

// TODO: test
async function chainExists(chainId) {
    return factomdjs.chainHead(chainId)
        .then(() => true)
        .catch(() => false);
}

function getChainId(chain) {
    const extIdsHashes = chain.extids.map(id => {
        const hash = crypto.createHash('sha256');
        hash.update(id);
        return hash.digest();
    });

    const totalLength = extIdsHashes.reduce((acc, val) => acc + val.length, 0);
    const hashes = Buffer.concat(extIdsHashes, totalLength);
    const hash = crypto.createHash('sha256');
    hash.update(hashes);
    return hash.digest('hex');
}

async function addChain(chain, ecpub) {
    const {
        commit,
        reveal
    } = await walletd.composeChain(chain.extids.map(toHex), toHex(chain.content), ecpub);

    const commitPromise = factomdjs.commitChain(commit.params.message).catch(function (e) {
        if (e.message === "Repeated Commit") {
            console.error(e);
        } else {
            throw e;
        }
    });

    const [committed, revealed] = await Promise.all([
        commitPromise,
        factomdjs.revealChain(reveal.params.entry)
    ]);

    console.log(committed)
    console.log("-------------")
    console.log(revealed)
    console.log("-------------")
    return Promise.resolve(revealed);
}

async function addEntry(entry, ecpub) {
    const {
        commit,
        reveal
    } = await walletd.composeEntry(entry.chainid, entry.extids.map(toHex), toHex(entry.content), ecpub);

    const commitPromise = factomdjs.commitEntry(commit.params.message).catch(function (e) {
        if (e.message === "Repeated Commit") {
            console.error(e);
        } else {
            throw e;
        }
    });

    const [committed, revealed] = await Promise.all([
        commitPromise,
        factomdjs.revealEntry(reveal.params.entry)
    ]);

    console.log(committed)
    console.log("-------------")
    console.log(revealed)
    console.log("-------------")
    return Promise.resolve(revealed.entryhash);
}

async function addEntries(entries, ecpub) {
    return Promise.map(entries, entry => addEntry(entry, ecpub));
}

function toHex(input) {
    if (!input) {
        return '';
    }

    const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
    return buffer.toString('hex');
}

function entrySize(entry) {
    // 35 = header size
    let size = 35;

    if (Array.isArray(entry.extids)) {
        const extidsBuffers = entry.extids.map(extid => Buffer.isBuffer(extid) ? extid : Buffer.from(extid));
        const extidsLength = Buffer.concat(extidsBuffers).length;
        size += 2 * entry.extids.length + extidsLength;

    }

    if (entry.content) {
        size += entry.content.length;
    }

    return size;
}

function chainCost(firstEntry) {
    return 10 + entryCost(firstEntry);
}

function entryCost(entry) {
    let cost = 0;
    // Header size (35) is not counted in the cost
    const dataLength = entrySize(entry) - 35;
    if (dataLength > 10240) {
        throw 'Entry cannot be larger than 10Kb';
    }

    return Math.ceil(dataLength / 1024);
}

function waitOnCommitAck(txid, to) {
    const timeout = to || 60;
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
        const clearId = setInterval(async function () {
            process.stdout.write(".");
            const ackResponse = await factomdjs.ack(txid, 'c');
            const status = ackResponse.commitdata.status;

            if (status !== "Unknown" && status !== "NotConfirmed") {
                clearInterval(clearId);
                process.stdout.write('\n');
                resolve(status);
            }

            if ((Date.now() - startTime) > timeout * 1000) {
                clearInterval(clearId);
                process.stdout.write('\n');
                reject('Ack timeout');
            }

        }, 200);
    });
}

function waitOnRevealAck(hash, chainid, to) {
    if (!hash || !chainid) {
        return Promise.reject('Invalid argument: hash or chain ID is missing');
    }
    const timeout = to || 60;
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
        const clearId = setInterval(async function () {
            process.stdout.write(".");
            const ackResponse = await factomdjs.ack(hash, chainid);
            const status = ackResponse.entrydata.status;

            if (status !== "Unknown" && status !== "NotConfirmed") {
                clearInterval(clearId);
                process.stdout.write('\n');
                resolve(status);
            }

            if ((Date.now() - startTime) > timeout * 1000) {
                clearInterval(clearId);
                process.stdout.write('\n');
                reject('Ack timeout');
            }

        }, 200);
    });
}



// addChain({
//             extids: ["hello-world8"],
//             content: "content"
//         },
//         "EC2vXWYkAPduo3oo2tPuzA44Tm7W6Cj7SeBr3fBnzswbG5rrkSTD"
//     )
//     .then(console.log)
//     .catch(console.error);

// const l = 1024 - 2 * 2 - 3 - 3;

// const str = new Array(l + 1).join('r');
// console.log(str.length)

// const entry = {
//     chainid: "ac44e52c539065efa3563104248c984ef893f0e3351d7c59c93bf022d2214e63",
//     extids: ["arf", "arf"],
//     content: str
// };
// console.log(entryCost(entry))
// addEntry(entry, "EC2vXWYkAPduo3oo2tPuzA44Tm7W6Cj7SeBr3fBnzswbG5rrkSTD")
//     .then(entryHash => waitOnRevealAck(entryHash, entry.chainid))
//     .then(console.log)
//     .catch(console.error)

// addEntries([{
//         chainid: "332d06db89e9f4fbf7c7940c21ca7aa01a38f8c332d79dcf234538afa9d6b31a",
//         extids: ["hello-world4"],
//         content: "my content"
//     }, {
//         chainid: "332d06db89e9f4fbf7c7940c21ca7aa01a38f8c332d79dcf234538afa9d6b31a",
//         extids: ["hello-world6"],
//         content: "my content"
//     }], "EC2vXWYkAPduo3oo2tPuzA44Tm7W6Cj7SeBr3fBnzswbG5rrkSTD")
//     .then(console.log)
//     .catch(console.error);

// getFirstEntry('43649840f6342be91be137e46f447cffaa6796b7fe6f4fdd8acb80744ab1cd6c').then(console.log)

module.exports = {
    setFactomNode,
    setFactomWallet,
    getAllEntriesOfChain,
    getAllEntriesOfEntryBlock,
    getFirstEntry,
    getChainHead,
    getChainId,
    entrySize,
    entryCost,
    chainCost,
    addChain,
    addEntry,
    addEntries,
    waitOnRevealAck,
    waitOnCommitAck
}
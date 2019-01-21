const crypto = require('crypto'),
    sign = require('tweetnacl/nacl-fast').sign,
    Promise = require('bluebird'),
    prompt = require('prompt'),
    { getChainAndEntries } = require('./FileToFactomStruct'),
    log = require('winston');

const {
    FactomCli,
    getPublicAddress,
    isValidEcAddress
} = require('factom');


class InteractiveWriter {
    constructor(opt) {
        this.fctCli = new FactomCli(opt);
    }

    async write(file, ecAddress) {
        validateRequest(ecAddress);

        const secret = crypto.randomBytes(32);
        const key = sign.keyPair.fromSeed(secret);

        const { chain, entries } = await getChainAndEntries(file, key);
        const chainId = await write(this.fctCli, chain, entries, ecAddress);

        return {
            chainId,
            secretKey: secret.toString('hex')
        };
    }
}

function validateRequest(ecAddress) {
    if (!isValidEcAddress(ecAddress)) {
        throw new Error(`${ecAddress} is not a valid EC address`);
    }
}

async function write(fctCli, chain, entries, ecAddress) {
    await costConfirm(fctCli, chain, entries, ecAddress);

    log.info(`Creating file chain [${chain.idHex}]...`);
    await fctCli.add(chain, ecAddress, { commitTimeout: -1, revealTimeout: -1 });
    log.info('Chain of the file created');
    log.info('Persisting parts...');
    await fctCli.add(entries, ecAddress, { commitTimeout: -1, revealTimeout: -1 });

    return chain.idHex;
}

async function costConfirm(fctCli, chain, entries, ecAddress) {
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

module.exports = {
    InteractiveWriter
};
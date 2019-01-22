const ora = require('ora'),
    chalk = require('chalk'),
    identity = require('factom-identity-lib').digital,
    inquirer = require('inquirer'),
    { getChainAndEntries } = require('./FileToFactomStruct');

const {
    FactomCli,
    getPublicAddress,
    isValidEcAddress
} = require('factom');


class InteractiveWriter {
    constructor(opt) {
        this.fctCli = new FactomCli(opt);
    }

    async write(file, ecAddress, key) {
        validateRequest(ecAddress);

        const secretKey = await getSecretKey(this.fctCli, key);
        const { chain, entries } = await getChainAndEntries(file, secretKey);
        await write(this.fctCli, chain, entries, ecAddress);

        const result = { chainId: chain.idHex, publicKey: identity.getPublicIdentityKey(secretKey) };
        // If a random key was generated on-demand it needs to be returned to the user
        if (!key) {
            result.secretKey = secretKey;
        }

        return result;
    }
}

async function getSecretKey(cli, key) {

    if (key) {
        if (identity.isValidSecretIdentityKey(key)) {
            return key;
        } else if (identity.isValidPublicIdentityKey(key)) {
            const { secret } = await cli.walletdApi('identity-key', { public: key });
            return secret;
        } else {
            return identity.seedToSecretIdentityKey(key);
        }
    } else {
        return identity.generateRandomIdentityKeyPair().secret;
    }
}

function validateRequest(ecAddress) {
    if (!isValidEcAddress(ecAddress)) {
        throw new Error(`${ecAddress} is not a valid EC address.`);
    }
}

async function write(fctCli, chain, entries, ecAddress) {
    await costConfirm(fctCli, chain, entries, ecAddress);
    await addChain(fctCli, chain, ecAddress);
    await addEntries(fctCli, entries, ecAddress);
}

async function addChain(fctCli, chain, ecAddress) {
    const spinner = ora(`Writing file chain ${chalk.yellow(chain.idHex)}...`).start();

    try {
        await fctCli.add(chain, ecAddress, { commitTimeout: -1, revealTimeout: -1 });
        spinner.succeed();
    } catch (e) {
        spinner.fail();
        throw e;
    }
}

async function addEntries(fctCli, entries, ecAddress) {
    const spinner = ora('Writing file parts entries...').start();

    try {
        await fctCli.add(entries, ecAddress, { commitTimeout: -1, revealTimeout: -1 });
        spinner.succeed();
    } catch (e) {
        spinner.fail();
        throw e;
    }
}

async function costConfirm(fctCli, chain, entries, ecAddress) {
    const cost = entries.reduce((acc, entry) => acc + entry.ecCost(), chain.ecCost());
    const publicAddress = getPublicAddress(ecAddress);
    const availableBalance = await fctCli.getBalance(publicAddress);

    if (cost > availableBalance) {
        throw new Error(`EC cost to persist: ${cost.toLocaleString()}. Available balance (${availableBalance.toLocaleString()}) of address ${publicAddress} is not enough.`);
    }

    const dollarCost = (cost * 0.001).toLocaleString();
    console.error(`Cost: ${chalk.yellow(cost.toLocaleString() + ' EC')} (~$${dollarCost}) (available balance: ${availableBalance.toLocaleString()} EC)`);

    const answers = await inquirer.prompt([{ type: 'confirm', name: 'upload', message: 'Confirm upload?', default: false }]);
    console.error();
    if (!answers.upload) {
        process.exit(0);
    }
}


module.exports = {
    InteractiveWriter
};
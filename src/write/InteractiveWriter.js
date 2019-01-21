const crypto = require('crypto'),
    ora = require('ora'),
    chalk = require('chalk'),
    sign = require('tweetnacl/nacl-fast').sign,
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

    async write(file, ecAddress) {
        validateRequest(ecAddress);

        const secret = crypto.randomBytes(32);
        const key = sign.keyPair.fromSeed(secret);

        const { chain, entries } = await getChainAndEntries(file, key);
        await write(this.fctCli, chain, entries, ecAddress);

        return {
            chainId: chain.idHex,
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

    console.error(`Cost: ${chalk.yellow(cost.toLocaleString() + ' EC')} (~$${cost * 0.001}) (available balance: ${availableBalance.toLocaleString()} EC)`);

    const answers = await inquirer.prompt([{ type: 'confirm', name: 'upload', message: 'Confirm upload?', default: false }]);
    console.error();
    if (!answers.upload) {
        process.exit(0);
    }
}


module.exports = {
    InteractiveWriter
};
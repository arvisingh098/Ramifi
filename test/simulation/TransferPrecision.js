/*
  In this truffle script, we generate random cycles of fragments growth and contraction
  and test the precision of fragments transfers

  During every iteration; percentageGrowth is sampled from a unifrom distribution between [-50%,250%]
  and the fragments total supply grows/contracts.

  In each cycle we test the following guarantees:
  - If address 'A' transfers x fragments to address 'B'. A's resulting external balance will
  be decreased by precisely x fragments, and B's external balance will be precisely
  increased by x fragments.

  USAGE:
  npx truffle --network ganacheUnitTest exec ./test/simulation/transfer_precision.js
*/

const expect = require('chai').expect;
const RamifiToken = artifacts.require('Ramifi.sol');
const _require = require('app-root-path').require;
const BlockchainCaller = _require('/util/BlockchainCaller');
const chain = new BlockchainCaller(web3);
const encodeCall = require('zos-lib/lib/helpers/encodeCall').default;
const Stochasm = require('stochasm');
const BN = web3.utils.BN;

// const endSupply = new BigNumber(2).pow(128).minus(1);
const endSupply = new BN(5);
const RamifiTokenGrowth = new Stochasm({ min: -0.5, max: 2.5, seed: 'fragments.org' });

let RamifiToken, rebaseAmt, inflation, preRebaseSupply, postRebaseSupply;
rebaseAmt = new BN(0);
preRebaseSupply = new BN(0);
postRebaseSupply = new BN(0);

async function checkBalancesAfterOperation (users, op, chk) {
  const _bals = [ ];
  const bals = [ ];
  let u;
  for (u in users) {
    if (Object.prototype.hasOwnProperty.call(users, u)) {
      _bals.push(await RamifiToken.balanceOf.call(users[u]));
    }
  }
  await op();
  for (u in users) {
    if (Object.prototype.hasOwnProperty.call(users, u)) {
      bals.push(await RamifiToken.balanceOf.call(users[u]));
    }
  }
  chk(_bals, bals);
}

async function checkBalancesAfterTransfer (users, tAmt) {
  await checkBalancesAfterOperation(users, async function () {
    await RamifiToken.transfer(users[1], tAmt, { from: users[0] });
  }, function ([_u0Bal, _u1Bal], [u0Bal, u1Bal]) {
    const _sum = _u0Bal.plus(_u1Bal);
    const sum = u0Bal.plus(u1Bal);
    expect(_sum.eq(sum)).to.be.true;
    expect(_u0Bal.minus(tAmt).eq(u0Bal)).to.be.true;
    expect(_u1Bal.plus(tAmt).eq(u1Bal)).to.be.true;
  });
}

async function exec () {
  const accounts = await chain.getUserAccounts();
  const deployer = accounts[0];
  const user = accounts[1];
  RamifiToken = await RamifiToken.new();
  await RamifiToken.sendTransaction({
    data: encodeCall('initialize', ['address'], [deployer]),
    from: deployer
  });
  await RamifiToken.setMonetaryPolicy(deployer, {from: deployer});

  let i = 0;
  do {
    await RamifiToken.rebase(i + 1, rebaseAmt, {from: deployer});
    postRebaseSupply = await RamifiToken.totalSupply.call();
    i++;

    console.log('Rebased iteration', i);
    console.log('Rebased by', (rebaseAmt.toString()), 'AMPL');
    console.log('Total supply is now', postRebaseSupply.toString(), 'AMPL');

    console.log('Testing precision of 1c transfer');
    await checkBalancesAfterTransfer([deployer, user], 1);
    await checkBalancesAfterTransfer([user, deployer], 1);

    console.log('Testing precision of max denomination');
    const tAmt = (await RamifiToken.balanceOf.call(deployer));
    await checkBalancesAfterTransfer([deployer, user], tAmt);
    await checkBalancesAfterTransfer([user, deployer], tAmt);

    preRebaseSupply = await RamifiToken.totalSupply.call();
    inflation = RamifiTokenGrowth.next().toFixed(5);
    rebaseAmt = preRebaseSupply.mul(inflation).dividedToIntegerBy(1);
  } while ((await RamifiToken.totalSupply.call()).plus(rebaseAmt).lt(endSupply));
}

module.exports = function (done) {
  exec().then(done).catch(e => {
    console.error(e);
    process.exit(1);
  });
};

/*
  In this truffle script,
  During every iteration:
  * We double the total fragments supply.
  * We test the following guarantee:
      - the difference in totalSupply() before and after the rebase(+1) should be exactly 1.

  USAGE:
  npx truffle --network ganacheUnitTest exec ./test/simulation/supply_precision.js
*/

const expect = require('chai').expect;
const RamifiToken = artifacts.require('Ramifi');
const _require = require('app-root-path').require;
const BlockchainCaller = _require('/util/BlockchainCaller');
const chain = new BlockchainCaller(web3);
const encodeCall = require('zos-lib/lib/helpers/encodeCall').default;
const BN = web3.utils.BN;

//const endSupply = new BN(2).pow(128).minus(1);
const endSupply = new BN(5);

let RamifiToken, preRebaseSupply, postRebaseSupply;
preRebaseSupply = new BN(0);
postRebaseSupply = new BN(0);

async function exec () {
  const accounts = await chain.getUserAccounts();
  const deployer = accounts[0];
  RamifiToken = await RamifiToken.new();
  await RamifiToken.sendTransaction({
    data: encodeCall('initialize', ['address'], [deployer]),
    from: deployer
  });
  await RamifiToken.setMonetaryPolicy(deployer, {from: deployer});

  let i = 0;
  do {
    console.log('Iteration', i + 1);

    preRebaseSupply = await RamifiToken.totalSupply.call();
    await RamifiToken.rebase(2 * i, 1, {from: deployer});
    postRebaseSupply = await RamifiToken.totalSupply.call();
    console.log('Rebased by 1 AMPL');
    console.log('Total supply is now', postRebaseSupply.toString(), 'AMPL');

    console.log('Testing precision of supply');
    expect(postRebaseSupply.minus(preRebaseSupply).toNumber()).to.eq(1);

    console.log('Doubling supply');
    await RamifiToken.rebase(2 * i + 1, postRebaseSupply, {from: deployer});
    i++;
  } while ((await RamifiToken.totalSupply.call()).lt(endSupply));
}

module.exports = function (done) {
  exec().then(done).catch(e => {
    console.error(e);
    process.exit(1);
  });
};

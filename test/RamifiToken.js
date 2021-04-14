const RamifiToken = artifacts.require("Ramifi");

contract('Ramifi', (accounts) => {
    it('should start with a total supply of 50,000,000,000,000,000', async () => {
        let ramifiTokenInstance = await RamifiToken.deployed();
        let totalSupply = await ramifiTokenInstance.totalSupply();

        assert.equal(totalSupply.toString(), 50000000000000000, "50,000,000,000,000,000 isn't the total supply");
    }),
    it('should put 50,000,000,000,000,000 RamifiToken in the first account', async () => {
        let ramifiTokenInstance = await RamifiToken.deployed();
        let balance = await ramifiTokenInstance.balanceOf(accounts[0]);

        assert.equal(balance.toString(), 50000000000000000, "50,000,000,000,000,000 wasn't in the first account");
    });
});

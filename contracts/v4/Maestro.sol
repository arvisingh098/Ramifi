pragma solidity >=0.4.24 <0.6.0;

import "./library/SafeMath.sol";
import "./library/SafeMathInt.sol";
import "./interface/IERC20.sol";
import "./common/Initializable.sol";
import "./common/Ownable.sol";
import "./interface/IOracle.sol";
import "./interface/UInt256Lib.sol";
import "./Ramifi.sol";
import "./RamifiPolicy.sol";

interface IUniswapV2Pair {
    function sync() external;
}

/**
 * @title Maestro
 * @notice The Maestro is the main entry point for rebase operations. It coordinates the policy
 * actions with external consumers.
 */
contract Maestro is Ownable {
    struct Transaction {
        bool enabled;
        address destination;
        bytes data;
    }

    event TransactionFailed(
        address indexed destination,
        uint256 index,
        bytes data
    );

    // Stable ordering is not guaranteed.
    Transaction[] public transactions;

    RamifiPolicy public policy;
    
    address public uniPair;

    /**
     * @param policy_ Address of the Ramifi policy.
     */
    constructor(address policy_, address _pair) public {
        Ownable.initialize(msg.sender);
        policy = RamifiPolicy(policy_);
        uniPair = _pair;
    }

    /**
     * @notice Main entry point to initiate a rebase operation.
     *         The Maestro calls rebase on the policy and notifies downstream applications.
     *         Contracts are guarded from calling, to avoid flash loan attacks on liquidity
     *         providers.
     *         If a transaction in the transaction list reverts, it is swallowed and the remaining
     *         transactions are executed.
     */
    function rebase() external {
        require(msg.sender == tx.origin); // solhint-disable-line avoid-tx-origin

        policy.rebase();
        IUniswapV2Pair(uniPair).sync();

        for (uint256 i = 0; i < transactions.length; i++) {
            Transaction storage t = transactions[i];
            if (t.enabled) {
                bool result = externalCall(t.destination, t.data);
                if (!result) {
                    emit TransactionFailed(t.destination, i, t.data);
                    revert("Transaction Failed");
                }
            }
        }
    }
    
    // Emergency Rebase
    function emergencyRebase(uint256 _price)
        external 
        onlyOwner
    {
        policy.emergencyRebase(_price);
        IUniswapV2Pair(uniPair).sync();
    }

    /**
     * @notice Adds a transaction that gets called for a downstream receiver of rebases
     * @param destination Address of contract destination
     * @param data Transaction data payload
     */
    function addTransaction(address destination, bytes data)
        external
        onlyOwner
    {
        transactions.push(
            Transaction({enabled: true, destination: destination, data: data})
        );
    }

    /**
     * @param index Index of transaction to remove.
     *              Transaction ordering may have changed since adding.
     */
    function removeTransaction(uint256 index) external onlyOwner {
        require(index < transactions.length, "index out of bounds");

        if (index < transactions.length - 1) {
            transactions[index] = transactions[transactions.length - 1];
        }

        transactions.length--;
    }

    /**
     * @param index Index of transaction. Transaction ordering may have changed since adding.
     * @param enabled True for enabled, false for disabled.
     */
    function setTransactionEnabled(uint256 index, bool enabled)
        external
        onlyOwner
    {
        require(
            index < transactions.length,
            "index must be in range of stored tx list"
        );
        transactions[index].enabled = enabled;
    }

    /**
     * @return Number of transactions, both enabled and disabled, in transactions list.
     */
    function transactionsSize() external view returns (uint256) {
        return transactions.length;
    }

    /**
     * @dev wrapper to call the encoded transactions on downstream consumers.
     * @param destination Address of destination contract.
     * @param data The encoded data payload.
     * @return True on success
     */
    function externalCall(address destination, bytes data)
        internal
        returns (bool)
    {
        bool result;
        assembly {
            // solhint-disable-line no-inline-assembly
            // "Allocate" memory for output
            // (0x40 is where "free memory" pointer is stored by convention)
            let outputAddress := mload(0x40)

            // First 32 bytes are the padded length of data, so exclude that
            let dataAddress := add(data, 32)

            result := call(
                // 34710 is the value that solidity is currently emitting
                // It includes callGas (700) + callVeryLow (3, to pay for SUB)
                // + callValueTransferGas (9000) + callNewAccountGas
                // (25000, in case the destination address does not exist and needs creating)
                sub(gas, 34710),
                destination,
                0, // transfer value in wei
                dataAddress,
                mload(data), // Size of the input, in bytes. Stored in position 0 of the array.
                outputAddress,
                0 // Output is ignored, therefore the output size is zero
            )
        }
        return result;
    }
}
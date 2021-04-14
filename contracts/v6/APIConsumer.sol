pragma solidity ^0.6.0;

import "@chainlink/contracts/src/v0.6/ChainlinkClient.sol";

interface IMedianOracle {
    function pushReport(uint256 payload) external;
}

interface IMaestro {
    function rebase() external;
}

contract APIConsumer is ChainlinkClient {
  
    uint256 public volume;
    
    address private oracle;
    bytes32 private jobId;
    uint256 private fee;
    address public oracleReport;
    
    /**
     * Network: Kovan
     * Oracle: 0x2f90A6D021db21e1B2A077c5a37B3C7E75D15b7e
     * Job ID: 29fa9aa13bf1468788b7cc4a500a45b8
     * Fee: 0.1 LINK
     */
    constructor(address _oracle) public {
        setPublicChainlinkToken();
        oracle = 0x72f3dFf4CD17816604dd2df6C2741e739484CA62;
        jobId = "5d1f6593e5c74d03ac9c24f4072745e0";
        fee = 0.1 * 10 ** 18; // 0.1 LINK
        oracleReport = _oracle;
    }
    
    /**
     * Create a Chainlink request to retrieve API response, find the target
     * data, then multiply by 1000000000000000000 (to remove decimal places from data).
     */
    function requestVolumeData() public returns (bytes32 requestId) 
    {
        Chainlink.Request memory request = buildChainlinkRequest(jobId, address(this), this.fulfill.selector);
        
        // Set the URL to perform the GET request on
        request.add("get", "https://www.quandl.com/api/v3/datasets/RICI/RICI.json?rows=1&api_key=PysSFw3KJSqEj5yjH7P-");
        request.add("path", "dataset.data.0.1");
        
        // Multiply the result by 1000000000000000000 to remove decimals
        int timesAmount = 10**18;
        request.addInt("times", timesAmount);
        
        // Sends the request
        return sendChainlinkRequestTo(oracle, request, fee);
    }
    
    /**
     * Receive the response in the form of uint256
     */ 
    function fulfill(bytes32 _requestId, uint256 _volume) public recordChainlinkFulfillment(_requestId)
    {
        volume = _volume;
        IMedianOracle(oracleReport).pushReport(volume);
    }
}
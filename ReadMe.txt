Deploy steps:-

Add private key, infura key and etherscan key inside all truffle files(truffle_config_v4, truffle_config_v5, truffle_config_v6)

- npm install
- truffle compile --config ./truffle_config_v4.js
- truffle compile --config ./truffle_config_v5.js
- truffle compile --config ./truffle_config_v6.js
- truffle migrate --network kovan --config ./truffle_config_v6.js


verify contracts:-
truffle run verify Ramifi@0x1BC803b975231b46B6ea8Cf001c1D8bca6b0f941 --network kovan --config ./truffle_config_v4.js
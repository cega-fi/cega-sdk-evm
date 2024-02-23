# EVM SDK V1
path_to_cega_eth_v1="../cega-eth-v1/artifacts/contracts"

echo "Creating directories"
mkdir -p ./src/abi/viewers
echo "Created directories"

abis=( CegaState Oracle FCNProduct FCNVault LOVProduct )
for abi in "${abis[@]}"
do
  echo "${abi}"
  cp "${path_to_cega_eth_v1}/${abi}.sol/${abi}.json" ./src/abi/
done
echo "Done copying ABIs"

viewer_abis=( CegaViewer )
for viewer_abi in "${viewer_abis[@]}"
do
  cp "${path_to_cega_eth_v1}/viewers/${viewer_abi}.sol/${viewer_abi}.json" ./src/abi/viewers
done

# EVM SDK V2
echo "Starting copying ABIs for v2"
path_to_cega_eth_v2="../cega-eth-v2/artifacts/contracts"
path_to_abis_v2="./src/abiV2"
mkdir -p "${path_to_abis_v2}"

cp "${path_to_cega_eth_v2}/common/interfaces/ICegaCombinedEntry.sol/ICegaCombinedEntry.json" ${path_to_abis_v2}
cp "${path_to_cega_eth_v2}/cega-strategies/dcs/interfaces/IDCSEntry.sol/IDCSEntry.json" ${path_to_abis_v2}
cp "${path_to_cega_eth_v2}/proxies/interfaces/IWrappingProxy.sol/IWrappingProxy.json" ${path_to_abis_v2}
cp "${path_to_cega_eth_v2}/oracle-entry/OracleEntry.sol/OracleEntry.json" ${path_to_abis_v2}
cp "${path_to_cega_eth_v2}/aux/AddressManager.sol/AddressManager.json" ${path_to_abis_v2}
cp "${path_to_cega_eth_v2}/treasuries/Treasury.sol/Treasury.json" ${path_to_abis_v2}
cp "${path_to_cega_eth_v2}/oracle-entry/adapters/PythAdapter.sol/PythAdapter.json" ${path_to_abis_v2}

echo "Completed copying ABIs for v2"

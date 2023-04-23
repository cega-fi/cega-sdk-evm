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

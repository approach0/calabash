#!/bin/bash
SCRIPT_DIR=$(dirname ${BASH_SOURCE[0]})

for envvar in ${!iaas_providers_@}; do
  provider=${!envvar}
  echo $provider
  if [ $provider == linode ]; then
    . $SCRIPT_DIR/linode.sh `unpack \$iaas_linode_{token,docker_mirror}`
  elif [ $provider == ucloud ]; then
    . $SCRIPT_DIR/ucloud.sh `unpack \$iaas_ucloud_{pubkey,prikey,username,password,docker_mirror}`
  else
    echo "ERROR: provider '$provider' not implemented."
    exit 1
  fi
done

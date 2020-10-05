#!/bin/bash
SCRIPT_DIR=$(dirname ${BASH_SOURCE[0]})

for envvar in ${!iaas_providers_@}; do
	provider=${!envvar}
	echo "source provider: $provider"
	if [ $provider == linode ]; then
		. $SCRIPT_DIR/linode.sh `unpack \$iaas_linode_{docker_image,token}`
	elif [ $provider == ucloud ]; then
		. $SCRIPT_DIR/ucloud.sh `unpack \$iaas_ucloud_{docker_image,pubkey,prikey,docker_mirror,username,password}`
	else
		echo "ERROR: provider '$provider' not implemented."
		exit 1
	fi
done

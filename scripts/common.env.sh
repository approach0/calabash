# common environment variables

# container command
DOCKER=docker

# less verbose SSH commands, disallowing password prompt
SSH_OPTIONS="-o PasswordAuthentication=no -o StrictHostKeyChecking=no -o ConnectTimeout=32" 
SSH="ssh $SSH_OPTIONS"
SCP="scp $SSH_OPTIONS" # Do not use SSH_OPTS for scp, it is undocumented but will affect scp behaviour.

# check variable existence
check_args() {
	set -e
	for argname in $@; do
		echo "checking argument $argname=${!argname}"
		if [ "${!argname}" == '' ]; then
			echo 'empty argument, abort.'
			exit 1
		fi
	done
	set +e
}

# unpack curly brace expandable variables
unpack() {
	eval echo $@
}

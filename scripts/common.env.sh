# common environment variables

DOCKER=docker

# less verbose SSH commands, disallowing password prompt
SSH_OPTS="-o PasswordAuthentication=no -o StrictHostKeyChecking=no -o ConnectTimeout=32" 
SSH="ssh $SSH_OPTS"
SCP="scp $SSH_OPTS"

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

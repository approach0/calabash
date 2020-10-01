# common environment variables

DOCKER=docker

# less verbose SSH command, disallowing password prompt
SSH="ssh -o PasswordAuthentication=no -o StrictHostKeyChecking=no -o ConnectTimeout=32"

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

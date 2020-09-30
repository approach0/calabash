#!/bin/bash
source $(dirname ${BASH_SOURCE[0]})/../common.env.sh

swarm_install() {
  SSH_ADDR=$1
  SSH_PORT=$2
  $SSH -p $SSH_PORT $SSH_ADDR "
    apt-get update

    which docker || curl -fsSL https://get.docker.com -o get-docker.sh
    which docker || sh get-docker.sh

    # get mosh in case of login in slow connection
    apt-get install -y -qq --no-install-recommends mosh
    echo '=== mosh login ==='
    echo mosh --ssh=\"'ssh -p ${SSH_PORT}'\" ${SSH_ADDR}
  "
}

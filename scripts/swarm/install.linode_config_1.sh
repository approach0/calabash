#!/bin/sh
apt-get update
which docker || curl -fsSL https://get.docker.com -o get-docker.sh
which docker || sh get-docker.sh

# get mosh in case of login in slow connection
apt-get install -y -qq --no-install-recommends mosh
echo Mosh Usage: mosh --ssh="'ssh -p 8921'" SSH_ADDR

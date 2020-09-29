# common environment variables

DOCKER=docker
#DOCKER_MIRROR=hub-mirror.c.163.com/

# less verbose SSH command, disallowing pasword promption
SSH="ssh -o PasswordAuthentication=no -o StrictHostKeyChecking=no"

rname_short() {
  mktemp | awk -F'.' '{print $2}'
}

rname_uuid() {
  cat /proc/sys/kernel/random/uuid
}

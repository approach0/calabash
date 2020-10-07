#!/bin/bash
random_short_token() {
	mktemp | awk -F'.' '{print $2}'
}

random_uuid() {
	cat /proc/sys/kernel/random/uuid
}

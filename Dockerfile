# base image
FROM debian:buster
RUN sed -i s@/deb.debian.org/@/mirrors.aliyun.com/@g /etc/apt/sources.list
RUN apt-get update
RUN apt-get install -y curl git wget expect

# always have identities, and allow self-login
ENV HOME=/root
RUN ssh-keygen -f ~/.ssh/id_rsa -t rsa -N ''
RUN cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys
RUN chmod og-wx ~/.ssh/authorized_keys

# install docker cli
ARG clipkg=docker-ce-cli_19.03.9~3-0~debian-buster_amd64.deb
RUN wget http://mirrors.aliyun.com/docker-ce/linux/debian/dists/buster/pool/stable/amd64/$clipkg
RUN dpkg -i $clipkg

# install nodejs
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs

# install python/pip
RUN apt-get install -y python3-pip
RUN ln -sf `which python3` /usr/bin/python

# clone and build this project
RUN mkdir -p /code
RUN git clone --depth 1 https://github.com/approach0/calabash /code/calabash
WORKDIR /code/calabash
RUN (cd cli && npm install)
RUN (cd jobd && npm install)
RUN (cd ui && npm install)

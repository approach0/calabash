# base image
FROM debian:buster
RUN apt-get update
RUN apt-get install -y curl

# install nodejs
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs

# install python/pip
RUN apt-get install -y python3-pip
RUN ln -sf `which python3` /usr/bin/python

# clone this project
RUN mkdir -p /code
RUN git clone --depth 1 https://github.com/approach0/calabash /code/calabash
WORKDIR /code/calabash
RUN (cd cli && npm install)
RUN (cd jobd && npm install)
RUN (cd ui && npm install)

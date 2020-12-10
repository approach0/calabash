Calabash -- A Docker Swarm based automation tool, designed with simplicity in mind. It provides built-in gateway, IaaS bootstrap and managing layer, HTTPs bootstrap, service discover, authentication paradigm and automation scripting based on Shell. It also has a dashboard UI.

## About
Calabash is an automation tool for small Dev team, with the following emphasises:

* Simplicity: Small codebase wrapping on top of Docker Swarm. You do not have to use K8S for setting up your online resume or personal blog, right?
* Declarative but simple schema: Calabash adapts TOML instead of YAML, with much less declarative entries to get work automated.
* Loving shell scripts: In contrast to some Cloud Native automation tools which require you to write Go and other fully featured programming languages for DevOps, Calabash still loves shell scripts, we believe they are suitable for system admin just like they are in the good old days. Experienced system admins can utilize their skills in shell scripting again.
* Modern: With latest Docker Swarm and Calabash, you can deploy highly available services with sharding, load balancing etc. All too easy!
* Built-in Web UI: It comes with a [dashboard UI](https://github.com/approach0/ui-calabash). What's more, Calabash is written in Node.js which is an uncommon choice in DevOps world, but because of this, the backend and UI comes together nicely with only Node.js ecosystem dependencies.
* VPS support: You can automate your tasks not only on Cloud Infrastructures like Amazon AWS, but also on Linode, Digital Ocean as well as many other VPS providers. Write a "bash script driver" to drive CLIs from infrastructure providers and you are good to go!

Calabash is designed for (and going to be used for) automating the hosting of Approach Zero search engine, it will be responsible to handle daily search engine tasks including regularly crawling, indexing and searching. Although still in early development, I hope later I will come back and say my time is very well spent on making such a tool.

### Quick start
First, run `jobd` server
```
# node ./jobd/jobd.js --config ./config.toml --no-looptask
```
(the job daemon uses docker so you have to run it as root)

Then bootstrap the calabash to remote node using CLI
```
$ node cli.js -j 'swarm:bootstrap?node_usage=persistent&iaascfg=ucloud_config_1'
```
and at the end it will output the bootstrap node IP address, you can now manipulate this remote calabash service, for example, expand (create and join) a new node:
```
$ node cli.js http://<IP>:<PORT> -j 'swarm:expand?iaascfg=ucloud_config_1&typeIP=private'
```

If you want to test locally at your computer, issue
```
$ node cli.js -j swarm:bootstrap_localmock?node_usage=persistent
```

You can view the remote log by specifying a task ID, for example
```
node cli.js http://106.75.167.xxx --task-log 123
```
alternatively (but more comprehensively)
```
node cli.js http://106.75.167.xxx --log task-123
```

To create a service named `hello` and *follow* log output:
```
$ node cli.js http://<IP>:<PORT> --follow -j swarm:service-create?service=hello
```

To update a service:
```
$ node cli.js http://<IP>:<PORT> -j swarm:service-update?service=calabash
```

To remove a service:
```
$ node cli.js http://<IP>:<PORT> -j swarm:rm-service?service=foo
```

To update calabash configs, you need to run (single job) `swarm:bootstrap` against local jobd:
```
$ node cli.js -j 'swarm:bootstrap?iaascfg=ucloud_config_1&nodeIP=<IP>' --single
```
Alternatively, use `swarm:bootstrap-update` to update bootstrap services:
```
$ node cli.js -j 'swarm:bootstrap-update?port=<PORT>&nodeIP=<IP>&services=calabash,gateway_bootstrap'
```

You can check if the calabash configs get updated by inspecting config entries in the newly started calabash service:
```
$ node cli.js http://<IP>:<PORT> --list-config
```

### Example
The following steps setup necessary services of Approach Zero

1. Bootstrap
```
$ node cli.js -j 'swarm:bootstrap?iaascfg=ucloud_config_1&node_usage=persistent'
```

2. Add 1 corpus nodes along with bootstrap node, for storing corpus
```
$ node cli.js http://<IP>:<PORT> --follow -j 'swarm:expand?iaascfg=ucloud_config_1&typeIP=private&node_usage=persistent&shard=2'
```

3. Create `corpus_syncd` and `crawler` services
```
$ node cli.js http://<IP>:<PORT> --follow -j swarm:service-create?service=corpus_syncd
$ node cli.js http://<IP>:<PORT> --follow -j swarm:service-create?service=crawler
$ node cli.js http://<IP>:<PORT> --follow -j swarm:list-services
```

Alternatively, if you want to create a service with specified sharding, run something like `swarm:service-create?service=corpus_syncd&service_corpus_syncd_mesh_sharding=3`.

4. Add 2 indexer nodes
```
$ node cli.js http://<IP>:<PORT> --follow -j 'swarm:expand?iaascfg=ucloud_config_1&typeIP=private&node_usage=persistent&shard=1'
$ node cli.js http://<IP>:<PORT> --follow -j 'swarm:expand?iaascfg=ucloud_config_1&typeIP=private&node_usage=persistent&shard=2'
$ node cli.js http://<IP>:<PORT> --follow -j swarm:list-nodes
```

5. Deploy `indexer` and `index_syncd` services on indexer nodes
```
$ node cli.js http://<IP>:<PORT> --follow -j swarm:service-create?service=indexer
$ node cli.js http://<IP>:<PORT> --follow -j swarm:service-create?service=index_syncd
$ node cli.js http://<IP>:<PORT> --follow -j swarm:list-services
```

6. Then invoke index `feeder` to transfer corpus files to indexer
```
$ node cli.js http://<IP>:<PORT> --follow -j swarm:service-create?service=feeder
```

7. Create 2 search nodes
```
$ node cli.js http://<IP>:<PORT> --follow -j 'swarm:expand?iaascfg=ucloud_config_1&typeIP=private&node_usage=searchd&shard=1'
$ node cli.js http://<IP>:<PORT> --follow -j 'swarm:expand?iaascfg=ucloud_config_1&typeIP=private&node_usage=searchd&shard=2'
$ node cli.js http://<IP>:<PORT> --follow -j swarm:list-nodes
```

8. Deploy `searchd` service on those search nodes
```
$ node cli.js http://<IP>:<PORT> --follow -j swarm:service-create?service=searchd
# Wait enough time for searchd to come up ...
$ node cli.js http://<IP>:<PORT> --follow -j swarm:service-create?service=searchd_mpi_run
```

Now, search daemon should be running and exposing port from searchd and can be accessed from any swarm node (either from a manager or a worker, since we are using default ingress network for swarm).
Test a query through a Approach Zero test script:
```
# docker run approach0/a0 test-query.sh http://<IP>:<SEARCHD_EXPOSED_PORT>/search /tmp/test-query.json
```

### Monitoring
After start `monitor` service, visit it via browser:
1. Login with user name and password both as `admin`
2. In `Configuration`, add data source of *Prometheus type* with URL `http://monitor:9090`
3. In `Create -> Import`, import a dashboard from existing JSON file (we have an example file at `configs/grafana-sample-panel.json`).

### Tips
To test service locally, it is useful to create an attachable overlay network to mock overlay network:
```
# docker network create --driver=overlay --attachable calabash_net
```
Now you are able to attach the overlay network with non-swarm `docker run` processes:
```
# docker run -it --network calabash_net -p 8090:3000 -e GF_SERVER_SERVE_FROM_SUB_PATH=true -e GF_SERVER_ROOT_URL=/grafana hub-mirror.c.163.com/grafana/grafana
```

It is also useful to setup a mock service for testing routes locally:
```
# docker run -it --publish 8080:80 --network calabash_net --mount type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock gateway
# docker service create --label=gateway.port=8080 --label=gateway.route=_root_ --network calabash_net ga6840/hello-httpd node hello.js 'This is the root service!'
```

### Example IaaS provider API
Linode:
```
[
  {
    "id": 18719901,
    "label": "linode18719901",
    "group": "",
    "status": "running",
    "created": "2019-12-07T07:08:27",
    "updated": "2019-12-07T07:08:55",
    "type": "g6-nanode-1",
    "ipv4": [
      "45.79.224.144"
    ],
    "ipv6": "2600:3c01::f03c:92ff:fe28:ab95/64",
    "image": "linode/debian9",
    "region": "us-west",
    "specs": {
      "disk": 25600,
      "memory": 1024,
      "vcpus": 1,
      "transfer": 1000
    },
    "alerts": {
      "cpu": 90,
      "network_in": 10,
      "network_out": 10,
      "transfer_quota": 80,
      "io": 10000
    },
    "backups": {
      "enabled": false,
      "schedule": {
        "day": null,
        "window": null
      },
      "last_successful": null
    },
    "hypervisor": "kvm",
    "watchdog_enabled": true,
    "tags": []
  },
  {
    "id": 18719979,
    "label": "linode18719979",
    "group": "",
    "status": "running",
    "created": "2019-12-07T07:21:19",
    "updated": "2020-10-14T07:26:16",
    "type": "g6-nanode-1",
    "ipv4": [
      "45.79.225.86"
    ],
    "ipv6": "2600:3c01::f03c:92ff:fe28:ab8d/64",
    "image": "linode/debian9",
    "region": "us-west",
    "specs": {
      "disk": 25600,
      "memory": 1024,
      "vcpus": 1,
      "transfer": 1000
    },
    "alerts": {
      "cpu": 90,
      "network_in": 10,
      "network_out": 10,
      "transfer_quota": 80,
      "io": 10000
    },
    "backups": {
      "enabled": false,
      "schedule": {
        "day": null,
        "window": null
      },
      "last_successful": null
    },
    "hypervisor": "kvm",
    "watchdog_enabled": true,
    "tags": []
  }
]
```

Ucloud:
```
[
  {
    "UHostName": "foobarbaz",
    "Remark": "",
    "ResourceID": "uhost-f0rjimam",
    "Group": "Default",
    "PrivateIP": "10.9.59.122",
    "PublicIP": "",
    "Config": "cpu:1 memory:1G disk:20G",
    "DiskSet": "Boot:CLOUD_RSSD:20G|Udisk:CLOUD_RSSD:20G",
    "Zone": "cn-bj2-02",
    "Image": "uimage-1xypxg|Debian 10.0 64位",
    "VPC": "uvnet-ytzvcyb3",
    "Subnet": "subnet-x0k1afg4",
    "Type": "O/",
    "State": "Running",
    "CreationTime": "2020-10-29"
  },
  {
    "UHostName": "calabash-admin-YbmnikKGwk",
    "Remark": "",
    "ResourceID": "uhost-0q3rhzta",
    "Group": "Default",
    "PrivateIP": "10.13.43.195",
    "PublicIP": "106.75.147.166",
    "Config": "cpu:1 memory:1G disk:20G",
    "DiskSet": "Boot:CLOUD_SSD:20G|Udisk:CLOUD_SSD:20G",
    "Zone": "cn-gd-02",
    "Image": "uimage-j0r4vh|Debian 9.9 64位",
    "VPC": "uvnet-touf2ybp",
    "Subnet": "subnet-b2ksux2q",
    "Type": "N/N3/HotPlug",
    "State": "Running",
    "CreationTime": "2020-10-29"
  }
]
```

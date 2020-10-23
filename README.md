## About
Calabash is an automation tool for small Dev team, with the following emphasises:

* Simplicity: Small codebase wrapping on top of Docker Swarm. You do not have to use K8S for setting up your online resume and blog, right?
* Declarative but simple schema: Calabash adapts TOML instead of YAML, with much less declarative entries to get work automated.
* Loving shell scripts: In contrast to some Cloud Native automation tools which require you to write Go and other fully featured programming languages for DevOps, Calabash still loves shell scripts, we believe they are suitable for system admin just like they are in the good old days. Experienced system admins can utilize their skills in shell scripting again.
* Modern: With latest Docker Swarm and Calabash, you can deploy highly available services with sharding, load balancing etc. All too easy!
* Built-in Web UI: It comes with a dashboard UI! What's more, Calabash is written in Node.js which is an uncommon choice in DevOps world, but because of this, the backend and UI comes together nicely with only Node.js ecosystem dependencies.
* VPS support: You can automate your tasks not only on Cloud Infrastructures like Amazon AWS, but also on Linode, Digital Ocean as well as many other VPS providers. Write a "bash script driver" to drive CLIs from infrastructure providers and you are good to go!

Calabash is designed for (and going to be used for) automating the hosting of Approach Zero search engine, it will be responsible to handle daily search engine tasks including regularly crawling, indexing and searching. Although still in early development, I hope later I will come back and say my time is very well spent on making such a tool.

### Quick start
First, run `jobd` server
```
# node ./jobd/jobd.js --config ./config.toml
```
(the job daemon uses docker so you have to run it as root)

Then bootstrap the calabash to remote node using CLI
```
$ node cli.js -j swarm:bootstrap?iaascfg=ucloud_config_1
```
and at the end it will output the bootstrap node IP address, you can now manipulate this remote calabash service, for example, expand (create and join) a new node:
```
$ node cli.js http://<IP>:<PORT> -j 'swarm:expand?iaascfg=ucloud_config_1&typeIP=private'
```

You can view the remote log by specifying a task ID, for example
```
node cli.js http://106.75.167.xxx --task-log 123
```
alternatively
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

You can check if the calabash configs get updated by inspecting config entries in the newly started calabash service:
```
$ node cli.js http://<IP>:<PORT> --list-config
```

### Example
The following steps setup necessary services of Approach Zero

1. Bootstrap
```
$ node cli.js -j 'swarm:bootstrap?iaascfg=ucloud_config_1&node_usage=host_corpus'
```

2. Add 1 corpus nodes along with bootstrap node, for storing corpus
```
$ node cli.js http://<IP>:<PORT> --follow -j 'swarm:expand?iaascfg=ucloud_config_1&typeIP=private&node_usage=host_corpus&shard=2'
```

3. Create `corpus_syncd` and `crawler` services
```
$ node cli.js http://<IP>:<PORT> --follow -j swarm:service-create?service=corpus_syncd
$ node cli.js http://<IP>:<PORT> --follow -j swarm:service-create?service=crawler
$ node cli.js http://<IP>:<PORT> --follow -j swarm:list-services
```

4. Add 2 indexer nodes
```
$ node cli.js http://<IP>:<PORT> --follow -j 'swarm:expand?iaascfg=ucloud_config_1&typeIP=private&node_usage=host_indexer&shard=1'
$ node cli.js http://<IP>:<PORT> --follow -j 'swarm:expand?iaascfg=ucloud_config_1&typeIP=private&node_usage=host_indexer&shard=2'
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
$ node cli.js http://<IP>:<PORT> --follow -j 'swarm:expand?iaascfg=ucloud_config_1&typeIP=private&node_usage=host_searchd&shard=1'
$ node cli.js http://<IP>:<PORT> --follow -j 'swarm:expand?iaascfg=ucloud_config_1&typeIP=private&node_usage=host_searchd&shard=2'
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
# docker run ga6840/a0 ./searchd/scripts/test-query.sh http://<IP>:<SEARCHD_EXPOSED_PORT>/search
```

### Monitoring
After start `gateway_monitor` service, visit it via browser:
1. Login with user name and password both as `admin`
2. In `Configuration`, add data source of *Prometheus type* with URL `http://gateway_monitor:9090`
3. (Optional) In `Explore`, it is a good place to test out some PromQL queries such as
	```
	increase(total_requests{uri!~"/metrics",uri!~"/services"}[1m])
	```
4. In `Create -> Import`, import a dashboard from existing JSON file (we have an example file at `configs/grafana-sample-panel.json`).

### Tips
To test service locally, it is useful to create an attachable overlay network to mock overlay network:
```
# docker network create --driver=overlay --attachable approach0
```
Now you are able to attach the overlay network with non-swarm `docker run` processes:
```
# docker run -it --network approach0 -p 8090:3000 -e GF_SERVER_SERVE_FROM_SUB_PATH=true -e GF_SERVER_ROOT_URL=/grafana hub-mirror.c.163.com/grafana/grafana
```

It is also useful to setup a mock service for testing routes locally:
```
# docker service create --label=gateway.port=8080 --label=gateway.route=_root_ --network approach0 ga6840/hello-httpd node hello.js 'This is the root service!'
```

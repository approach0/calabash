## About
Calabash is an automation tool for small Dev team, with the following emphasises:

* Simplicity: Small codebase wrapping on top of Docker Swarm, you do not have to use K8S for setting up your online resume, right?
* Declarative but simple schema: Calabash adapts TOML instead of YAML, with much less declarative entries to get work automated.
* Loving Shell scripts: In contrast to some cloud native automation tools which require you to write Go and other fully featured programming languages for DevOps, Calabash still loves shell scripts, we believe they are suitable for system admin just like the good old days.
* Modern: With latest Docker Swarm and Calabash, you can deploy highly available services, sharding, load balancing etc. All too easy!
* Built-in UI: It comes with an dashboard UI! What's more, Calabash is written in Node.js which is an uncommon choice in DevOps world, but because of this, the backend and UI comes together nicely with only Node.js ecosystem dependencies.
* VPS support: You can automate your tasks on Linode, Digital Ocean as well as Cloud Infrastructures like Amazon AWS. All you need to is to write some simple "bash script driver".

Calabash is designed for and going to be used for hosting of Approach Zero search engine, including regularly crawling, indexing and searching services. Although still in early development, I hope later I will come back and say my time is very well spent on making such a tool.

### Quick start
First, run `jobd` server
```sh
# node ./jobd/jobd.js --config ./config.toml
```
(the job daemon uses docker so you have to run it as root)

Then bootstrap the calabash to remote node using CLI
```sh
$ node cli.js -j swarm:bootstrap?iaascfg=ucloud_config_1
```
and at the end it will output the bootstrap node IP address, you can now manipulate this remote calabash service, for example, expand a new node:
```sh
$ node cli.js http://<IP>:<PORT> -j 'swarm:expand?iaascfg=ucloud_config_1&role=worker&typeIP=private'
```

You can view the remote log by specifying a task ID, for example
```sh
node cli.js http://106.75.167.xxx --task-log 123
```
alternatively
```sh
node cli.js http://106.75.167.xxx --log task-123
```

### Foo
More to come...

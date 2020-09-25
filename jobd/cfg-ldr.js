const fs = require("fs")
const TOML = require('fast-toml')
const DepGraph = require('dependency-graph').DepGraph
const _path = require('path')

const spawn = require('child_process').spawn

exports.load_env = function (env_file) {
  // system reserved env variables
  const reserved = ['PWD', 'SHLVL', '_', 'PATH', 'SHELL', 'HOME', 'USER', 'USERNAME', '']
  var output = ''

  return new Promise((resolve, reject) => {
    var proc = spawn(__dirname + '/source.sh', [env_file], {
      'env': {}
    })

    proc.stdout.on('data', data => { output += data.toString() })
    proc.stderr.on('data', data => { console.error('[error]', data.toString()) })
    proc.on('error', () => { reject() })

    proc.on('close', () => {
      const env_dict = output.split('\n').reduce((obj, line) => {
        const fields = line.split('=')
        const key = fields[0]
        /* we exclude those system reserved env variables */
        if (!reserved.includes(key) && key !== undefined) {
          let right_str = fields.slice(1).join('=')
          /* by default, printenv will not quote strings, if we source it latter
           * there will be error. so in case of spaces present, we quote it here */
          obj[key] = (right_str.split(' ').length > 1) ? `"${right_str}"` : right_str
        }

        return obj
      }, {})

      resolve(env_dict)
    })
  })
}

exports.load_cfg = async function (cfg_path) {
	return await TOML.parseFile(cfg_path)
}

exports.load_jobs = async function (jobs_dir) {
  const files = await fs.readdirSync(jobs_dir)
  const depGraph = new DepGraph()

  for (var i = 0; i < files.length; i++) {
    let filename = files[i]
    const ext = filename.split('.').slice(-2).join('.')
    const path = _path.resolve(jobs_dir) + '/' + filename

    if (ext === 'jobs.toml') {
      const toml = await TOML.parseFile(path)
      for (const key in toml) {
        if (!toml.hasOwnProperty(key)) continue

        const target = filename.split('.')[0] + ':' + key
        depGraph.addNode(target)
        depGraph.setNodeData(target, toml[key])
      }
    }
  }

  depGraph.overallOrder().forEach(function (target) {
    const targetProps = depGraph.getNodeData(target)
    const dep_field = targetProps['dep'] || []
    const deps = Array.isArray(dep_field) ? dep_field : [dep_field]
    deps.forEach((dep) => {
      try {
        depGraph.addDependency(target, dep)
      } catch (e) {
        throw(e)
      }
    })
  })

  return depGraph
}

if (require.main === module) {
  (async function () {
    const jobs = await exports.load_jobs('./test-jobs')
    const envs = await exports.load_cfg('./config.template.toml')
    console.log(jobs.nodes)
    console.log(envs)
  })()
}

const fs = require("fs")
const TOML = require('fast-toml')
const DepGraph = require('dependency-graph').DepGraph
const spawn = require('child_process').spawn
const _path = require('path')

function load_env_file(env_file) {
  const reserved = ['PWD', 'SHLVL', '_', '']
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
        if (!reserved.includes(key) && key !== undefined) {
          obj[key] = fields.slice(1).join('=')
        }

        return obj
      }, {})
      resolve(env_dict)
    })
  })
}

exports.load = async function (jobs_dir) {
  const files = await fs.readdirSync(jobs_dir)
  const depGraph = new DepGraph()
  let envs = {}

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

    } else if (ext === 'env.sh') {
      envs = await load_env_file(path)
    }
  }

  depGraph.overallOrder().forEach(function (target) {
    const targetProps = depGraph.getNodeData(target)
    const deps = targetProps['dep'] || []
    deps.forEach((dep) => {
      try {
        depGraph.addDependency(target, dep)
      } catch (e) {
        throw(e)
      }
    })
  })

  return {depGraph, envs}
}

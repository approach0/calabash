const fs = require("fs")
const TOML = require('fast-toml')
const DepGraph = require('dependency-graph').DepGraph
const _path = require('path')

function delayering(obj, outobj, stack) {
  for (var property in obj) {
    if (obj.hasOwnProperty(property)) {
      const next_stack = stack ? stack + '_' + property : property
      if (typeof obj[property] == "object") {
        delayering(obj[property], outobj, next_stack);
      } else {
        const key = next_stack.replace(/^environment_/, "")
        outobj[key] = obj[property]
      }
    }
  }
}

exports.load_cfg = async function (cfg_path) {
  let cfg_obj_tree = await TOML.parseFile(cfg_path)
  let cfg_obj_plain = {}
  delayering(cfg_obj_tree, cfg_obj_plain)
  return [cfg_obj_plain, cfg_obj_tree]
}

exports.load_jobs = async function (jobs_dir) {
  const files = await fs.readdirSync(jobs_dir)
  const depGraph = new DepGraph()

  for (var i = 0; i < files.length; i++) {
    let filename = files[i]
    const ext = filename.split('.').slice(-1).join()
    const path = _path.resolve(jobs_dir) + '/' + filename

    if (ext === 'toml') {
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
    const [envs, _] = await exports.load_cfg('./config.template.toml')
    console.log(jobs.nodes)
    console.log(envs)
  })()
}

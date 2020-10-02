const cfg_ldr = require('./cfg-ldr.js')
const job_runner = require('./job-runner.js')
const tasks = require('./tasks.js')
const logger = require('./logger.js')

const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')

const { program } = require('commander')

const default_port = 8964

/* parse program arguments */
program
  .usage(`[options]\n` +
  `Example: node ${__filename} --jobs-dir ./test-jobs --config ./config.template.toml`)
  .option('--jobs-dir <jobs directory>', 'specify jobs directory')
  .option('--config <config file path>', 'specify config file')

program.parse(process.argv)

/* load configurations and setup HTTP server */
var jobs = null
var cfgs = {}
var jobs_dir = './test-jobs'
var cfg_path = './config.template.toml'

var app = express()
app.use(bodyParser.json())
app.use(cors())

;(async function () {
  try {
    /* loading config file */
    cfg_path = program.config || cfg_path
    console.log(`Loading cfg_path=${cfg_path}`)
    cfgs = await cfg_ldr.load_cfg(cfg_path)
    cfgs._config_file_ = cfg_path
    console.log(cfgs)

    /* loading jobs */
    jobs_dir = cfgs.job_dir || program.jobsDir || jobs_dir
    console.log(`Loading jobs_dir=${jobs_dir}`)
    jobs = await cfg_ldr.load_jobs(jobs_dir)

    /* setup HTTP server */
    const port = cfgs.jobd_port || default_port
    app.listen(port)
    console.log(`Listen on ${port}`)
  } catch (err) {
    console.error(err.toString())
    process.exit(1)
  }
})()

process.on('SIGINT', function() {
  console.log('')
  console.log('Bye bye.')
  process.exit()
})

/* rout handlers for HTTP server */
app
.get('/', async function (req, res) {
  res.json({
    'jobd': 'hello world'
  })
})

.get('/get/log/:logid', async function (req, res) {
  const id = req.params.logid
  var log = ''

  try {
    logger.read(id,
      data => {
        log += data
      },
      () => {
        res.json({id, log})
      }
    )

  } catch (err) {
    res.json({
      'error': err.toString()
    })
  }
})

.get('/get/job/:jobname', async function (req, res) {
  try {
    const jobname = req.params.jobname
    const props = jobs.getNodeData(jobname)
    res.json({jobname, props})

  } catch (err) {
    res.json({
      'error': err.toString()
    })
  }
})

.get('/get/jobs', async function (req, res) {
  try {
    const all_nodes = jobs.overallOrder()
    const ret_objs = all_nodes.map(n => {
      return {
        name: n,
        props: jobs.getNodeData(n)
      }
    })
    res.json({'res': 'successful', 'jobs': ret_objs})

  } catch (err) {
    res.json({
      'error': err.toString()
    })
  }
})

.get('/get/tasks/:filter', async function (req, res) {
  try {
    const filter = req.params.filter
    const all_tasks = await tasks.get_list(filter)
    res.json({all_tasks})

  } catch (err) {
    res.json({
      'error': err.toString()
    })
  }
})

.get('/get/task/:taskid', async function (req, res) {
  try {
    const taskid = req.params.taskid
    const task = await tasks.get(taskid)
    res.json({task})

  } catch (err) {
    res.json({
      'error': err.toString()
    })
  }
})

.get('/get/config', async function (req, res) {
  try {
    res.json(cfgs)

  } catch (err) {
    res.json({
      'error': err.toString()
    })
  }
})

.post('/runjob', async function (req, res) {
  try {
    const reqJSON = req.body

    const [target, args] = job_runner.parseTargetArgs(reqJSON['goal'])
    const envObj = Object.assign(cfgs, args) // overwrite/merge into default configs
    const envs = job_runner.declare_envs(envObj)

    const run_cfg = {
      dryrun: reqJSON['dry_run'],
      insist: reqJSON['insist_job'],
      single: reqJSON['single_job'],
      jobs, envs, target
    }

    const ret = job_runner.run(run_cfg)
    res.json(ret)

  } catch (err) {
    res.json({
      'error': err.toString()
    })
  }
})

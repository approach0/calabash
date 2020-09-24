const jobs_ldr = require('./jobs-ldr.js')
const job_runner = require('./job-runner.js')
const tasks = require('./tasks.js')
const logger = require('./logger.js')

const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')

const port = 8964
var jobs_dir = './test-jobs'
var cfg_path = './config.template.toml'

const args = process.argv.slice(2)
if (args.length === 1)
  jobs_dir = args[0]
console.log(`jobd: loading jobs from ${jobs_dir} ...`)

process.on('SIGINT', function() {
  console.log('')
  console.log('Bye bye.')
  process.exit()
})

var app = express()
app.use(bodyParser.json())
app.use(cors())

app.listen(port)
console.log(`Listen on ${port}`)

const jobs = jobs_ldr.load_jobs(jobs_dir)
const cfgs = jobs_ldr.load_cfg(jobs_dir)

app
.get('/', async function (req, res) {
  res.json({
    'test': 'hello world'
  })
})

.get('/get/log/:jobname', async function (req, res) {
  const jobname = req.params.jobname
  var logdata = ''

  try {
    logger.read(jobname,
      data => {
        logdata += data
      },
      () => {
        res.json({jobname, logdata})
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
    const props = jobs.depGraph.getNodeData(jobname)
    res.json({jobname, props})

  } catch (err) {
    res.json({
      'error': err.toString()
    })
  }
})

.get('/get/jobs', async function (req, res) {
  try {
    const all_nodes = jobs.depGraph.overallOrder()
	  const ret_objs = all_nodes.map(n => {
      return {
        name: n,
        props: jobs.depGraph.getNodeData(n)
      }
    })
    res.json({'res': 'successful', 'jobs': ret_objs})

  } catch (err) {
    res.json({
      'error': err.toString()
    })
  }
})

.get('/get/tasks', async function (req, res) {
  try {
    const all_tasks = await tasks.get_list()
    res.json({all_tasks})

  } catch (err) {
    res.json({
      'error': err.toString()
    })
  }
})

.get('/get/envs', async function (req, res) {
  try {
    const envs = jobs.envs
    res.json({envs})

  } catch (err) {
    res.json({
      'error': err.toString()
    })
  }
})

.post('/runjob', async function (req, res) {
  try {
    const reqJSON = req.body
    const goal_job = reqJSON['goal'] || ''
    const dry_run = reqJSON['dry_run'] || false
    const single_job = reqJSON['single_job'] || false
    const status_task = reqJSON['status_task'] || false

    var runList = []
    if (single_job)
      runList = [goal_job]
    else
      runList = await job_runner.getRunList(jobs, goal_job)

    const taskID = await job_runner.runlist(jobs, runList, dry_run, status_task)
    res.json({taskID})

  } catch (err) {
    res.json({
      'error': err.toString()
    })
  }
})

if (false) {
  const axios = require('axios')

  setTimeout(() => {
    axios.post(`http://localhost:${port}/runjob`, {
      goal: 'hello-world:say-helloworld',
      dry_run: false,
      single_job: false,
    })
    .then(function (res) {
      console.log(res.data)
    })
    .catch(function (err) {
      console.log(err)
    })
  }, 3000)
}

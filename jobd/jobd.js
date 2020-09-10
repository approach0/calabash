const jobs_ldr = require('./jobs-ldr.js')
const job_runner = require('./job-runner.js')
const tasks = require('./tasks.js')
const logger = require('./logger.js')

const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')

const port = 8964
const jobs_dir = './test-jobs'

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

var jobs = {}
jobs_ldr.load(jobs_dir).then(_jobs => {
  jobs = _jobs
  console.log('jobs loaded.')
})

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

    var runList = []
    if (single_job)
      runList = [goal_job]
    else
      runList = await job_runner.getRunList(jobs, goal_job)

    const taskID = await job_runner.runlist(jobs, runList, dry_run)
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
      console.log(res.data);
    })
    .catch(function (err) {
      console.log(err);
    });
  }, 3000)
}

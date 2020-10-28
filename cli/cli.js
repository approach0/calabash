const axios = require('axios')
const { program } = require('commander')

const DEFAULT_URL = 'http://localhost:8964'

program
  .usage(`<URL> [options]\n` +
  `Example: node ${__filename} --job hello:world http://localhost:8964`)
  .option('-j, --job <job ID>', 'run Job')
  .option('-f, --follow', 'follow task log')
  .option('--log <log ID>', 'print job by ID (MASTER, job-<jobID>, or task-<taskID>)')
  .option('--task-log <task ID>', 'show specific task log w/o jobd wrapper')
  .option('--dryrun', 'dryrun mode')
  .option('--single', 'run w/o any dependent job')
  .option('--insist', 'run through jobs even if some jobs failed')
  .option('--pin-id <task ID>', 'use and return specified task ID')
  .option('-J, --list-jobs', 'list all jobs')
  .option('--list-config', 'list configuration variables')
  .option('--list-tasks <all | active | unactive>', 'list tasks')
  .option('--show-task <task ID>', 'show specific task')

program.parse(process.argv)

if (program.args.length == 0) {
  program.args.push(DEFAULT_URL)
}

if (program.log) {
  const url = `${program.args[0]}/get/log/${program.log}`
  const options = {}

  axios.get(url, options)
  .then(function (res) {
    console.log(res.data['log'])
  })
  .catch(function (err) {
    console.error(err.toString())
  });
}

if (program.listJobs) {
  const url = `${program.args[0]}/get/jobs`
  const options = {}

  axios.get(url, options)
  .then(function (res) {
    const str = JSON.stringify(res.data, null, 2)
    console.log(str)
  })
  .catch(function (err) {
    console.error(err.toString())
  });
}

if (program.listConfig) {
  const url = `${program.args[0]}/get/config`
  const options = {}

  axios.get(url, options)
  .then(function (res) {
    const str = JSON.stringify(res.data, null, 2)
    console.log(str)
  })
  .catch(function (err) {
    console.error(err.toString())
  });
}

if (program.showTask) {
  const taskID = program.showTask
  const url = `${program.args[0]}/get/task/${taskID}`
  const options = {}

  axios.get(url, options)
  .then(function (res) {
    const str = JSON.stringify(res.data, null, 2)
    console.log(str)
  })
  .catch(function (err) {
    console.error(err.toString())
  });
}

function printTaskLog(taskID, doClear) {
  const url = `${program.args[0]}/get/task/${taskID}`
  axios.get(url, {})
  .then(function (res) {
    const task = res.data['task']['runList']
    if (doClear) console.clear()
    task.forEach(job => {
      console.log(job['log'])
    })
  }).catch(function (err) {
    console.error(err.toString())
  });
}

if (program.taskLog) {
  const taskID = program.taskLog

  if (program.follow) {
    console.log('Following log ...')
    const timer = setInterval(function() {
      printTaskLog(taskID, true)
    }, 1000)
  } else {
    printTaskLog(taskID)
  }
}

if (program.listTasks) {
  const filter = program.listTasks
  const url = `${program.args[0]}/get/tasks/${filter}`
  const options = {}

  axios.get(url, options)
  .then(function (res) {
    const str = JSON.stringify(res.data, null, 2)
    console.log(str)
  })
  .catch(function (err) {
    console.error(err.toString())
  });
}

if (program.job) {
  const url = `${program.args[0]}/runjob`
  const options = {
    goal: program.job,
    dry_run: program.dryrun || false,
    single_job: program.single || false,
    insist_job: program.insist || false,
    pin_id_job: parseInt(program.pinId)
  }

  axios.post(url, options)
  .then(function (res) {
    const ret = res.data

    const str = JSON.stringify(ret, null, 2)
    console.log(str)

    if (program.follow && "runList" in ret) {
      console.log('Following log ...')
      const timer = setInterval(function() {
        printTaskLog(ret['task_id'], true)
      }, 1000)
    }
  })
  .catch(function (err) {
    console.error(err.toString())
  });
}

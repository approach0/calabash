const g_tasks = {}
var g_task_id = 0

function pidIsRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch(e) {
    return false;
  }
}

function flagDead(meta) {
  meta['alive'] = false
  meta['exit_time'] = Date.now()
  clearInterval(meta['checkalive'])
}

exports.add_task = function(runList, _status_task) {
  let use_id = 0
  if (!_status_task)
    use_id = ++g_task_id

  g_tasks[use_id] = runList.map((item) => {
    return {
      jobname: item,
      pid: -1,
      alive: false,
      spawn_time: null,
      checkalive: null,
      exit_time: null,
      exitcode: -1
    }
  })

  return use_id
}

exports.spawn_notify = function(task_id, idx, pid) {
  const task = g_tasks[task_id]
  if (task) {
    const meta = task[idx]
    meta['pid'] = pid
    meta['alive'] = true
    meta['spawn_time'] = Date.now()
    meta['checkalive'] = setInterval(function () {
      if (!pidIsRunning(pid)) {
        flagDead(meta)
      }
    }, 500)

    return 0
  }

  return 1
}

exports.exit_notify = function(task_id, idx, exitcode) {
  const task = g_tasks[task_id]
  if (task) {
    const meta = task[idx]
    meta['exitcode'] = exitcode
    flagDead(meta)

    return 0
  }

  return 1
}

exports.get_list = function() {
  return Object.keys(g_tasks).map(task_id => {
    return {
      "taskid": task_id,
      "runList": g_tasks[task_id].map(item => {
        var clone = Object.assign({}, item);
        delete clone.checkalive;
        return clone
      })
    }
  })
}

if (require.main === module) {
  const jobs_ldr = require('./jobs-ldr.js')
  const job_runner = require('./job-runner.js')

  ;(async function () {
    const jobs = await jobs_ldr.load('./test-jobs')
    const runList = await job_runner.getRunList(jobs, 'hello-world:say-helloworld')
    const task_id = await exports.add_task(runList)

    console.log(JSON.stringify(await exports.get_list()))

    exports.spawn_notify(task_id, 1, 123)

    console.log(JSON.stringify(await exports.get_list()))

    //exports.exit_notify(task_id, 1, 0)

    setTimeout(async function () {
      console.log(JSON.stringify(await exports.get_list()))
    }, 1000)

  })()
}

const g_tasks = {}
const g_pins = {}
var g_task_id = 0

function pidIsRunning(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch(e) {
    return false
  }
}

function flagDead(meta) {
  meta['alive'] = false
  meta['exit_time'] = Date.now()
  clearInterval(meta['checkalive'])
}

exports.add_task = function(runList, pin_id) {
  let use_id = 0
  if (pin_id > 0) {
    /* user has specified a taksID */
    use_id = pin_id
    g_pins[pin_id] = true
  } else {
    /* use a new taksID */
    do {
      g_task_id += 1
    } while (g_tasks[g_task_id])
    use_id = g_task_id
  }

  g_tasks[use_id] = runList.map(jobname => {
    return {
      jobname: jobname,
      pid: -1,
      alive: false,
      log: '',
      spawn_time: null,
      checkalive: null,
      exit_time: null,
      exitcode: -1
    }
  })

  return use_id
}

exports.log_notify = function(task_id, idx, lines) {
  const task = g_tasks[task_id]
  if (task) {
    const meta = task[idx]
    meta['log'] += lines
    return 0
  }

  return 1
}

exports.spawn_notify = function(task_id, idx, pid) {
  const task = g_tasks[task_id]
  if (task) {
    const meta = task[idx]
    /* meta should be rewritten in case of a loop task */
    meta['pid'] = pid
    meta['alive'] = true
    meta['log'] = ''
    meta['spawn_time'] = Date.now()
    meta['checkalive'] = setInterval(function () {
      if (!pidIsRunning(pid)) {
        flagDead(meta)
      }
    }, 500)
    meta['exit_time'] = null
    meta['exitcode'] = -1

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

exports.get = function(task_id, pruneLog) {
  try {
    return {
      "taskid": task_id,
      "runList": g_tasks[task_id].map(item => {
        var clone = Object.assign({}, item)
        delete clone.checkalive
        if (pruneLog)
          delete clone.log
        return clone
      })
    }
  } catch (e) {
    return {
      "taskid": task_id,
      "runList": []
    }
  }
}

exports.get_list = function(filter) {
  const all_tasks = Object.keys(g_tasks).map(task_id => {
    task_id = parseInt(task_id)
    return exports.get(task_id, g_pins[task_id] === undefined)
  })

  if (filter == 'all') {
    /* limit to recent 30 tasks at most */
    return all_tasks.slice(30)

  } else if (filter == 'active') {
    return all_tasks.filter(task => {
      if (g_pins[task.taskid])
        return true /* keep pinned jobs */
      else
        return task.runList.some(job => job.alive === true)
    })

  } else {
    return []
  }
}

if (require.main === module) {
  const cfg_ldr = require('./cfg-ldr.js')
  const job_runner = require('./job-runner.js')

  ;(async function () {
    const jobs = await cfg_ldr.load_jobs('./test-jobs')
    const [cfgs, _] = await cfg_ldr.load_cfg('./config.template.toml')

    const runList = await job_runner.getRunList(jobs, 'goodbye:talk-later')
    const task_id = await exports.add_task(runList)

    console.log(JSON.stringify(await exports.get(task_id, true)))
    console.log()

    exports.spawn_notify(task_id, 1, {foo: 'foo'}, 123)

    console.log(JSON.stringify(await exports.get_list('active')))
    console.log()

    setTimeout(async function () {
      exports.exit_notify(task_id, 1, {bar: 'bar'}, 0)
    }, 500)

    setTimeout(async function () {
      console.log(JSON.stringify(await exports.get_list('all')))
      console.log()

      console.log(JSON.stringify(await exports.get_list('active')))
      console.log()
    }, 1000)

  })()
}

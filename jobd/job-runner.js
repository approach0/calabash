const cfg_ldr = require('./cfg-ldr.js')
const logger = require('./logger.js')
const tasks = require('./tasks.js')
const extend = require('util')._extend
const process_ = require('process')
const pty = require('node-pty-prebuilt-multiarch')
const childProcess = require('child_process')
const os = require('os')
const querystring = require('querystring')

function logAndPrint(line, logIDs) {
  logIDs.forEach(logID => {
    logger.write(logID, line)
  })

  console.log(logIDs.join(',') + ' |', line)
}

exports.syncLoop = function (arr, doing, done) {
  let idx = 0
  let loop = {
    next: function () {
      if (idx + 1 < arr.length) {
        idx = idx + 1
        doing(arr, idx, loop)
      } else {
        done(arr, arr.length - 1, loop, true)
      }
    },

    again: function () {
      doing(arr, idx, loop)
    },

    brk: function () {
      done(arr, arr.length - 1, loop, false)
    }
  }

  loop.again()
}

exports.getRunList = function (jobs, target) {
  const deps = jobs.dependenciesOf(target)
  deps.push(target)
  return deps
}

exports.runcmd = function (cmd, opt, onLog, onSpawn, onExit)
{
  /* choose between pty.spawn and childProcess.spawn */
  let spawnFun = pty.spawn
  let stdout = function (o) {return o}
  let stderr = function (o) {return {'on': function (d) {}}}
  let stdin  = function (o) {return o}
  let stdlog = function (o) {onLog(o)}

  if (opt.spawn == 'direct') {
    spawnFun = childProcess.spawn
    stdout = function (o) {return o.stdout}
    stderr = function (o) {return o.stderr}
    stdin  = function (o) {return o.stdin}
    stdlog = function (o) {onLog(o.toString())}
  } else if (opt.spawn != 'pty') {
    onLog('[ error ] spawn method unrecognized.')
  }

  /* get gid/uid numbers */
  let uid = 0
  let gid = 0
  if (opt.user != 'root') {
    uid = process_.getuid()
    gid = process_.getgid()
  }

  return new Promise((resolve, reject) => {
    /* spawn runner process */
    let runner
    const tmpdir = os.tmpdir()
    try {
      const hooked_cmd =
      `__hook__() { ec=$?; env > ${tmpdir}/env-pid$$.log; exit $ec; }\n` +
      'trap __hook__ EXIT \n' + cmd

      runner = spawnFun('/bin/sh', ['-c', hooked_cmd], {
        uid, gid,
        'cwd': opt.cwd,
        'env': opt.env,
        'cols': 80,
        'rows': 30,
        'name': 'xterm-color'
      })
    } catch (err) {
      reject(err)
      return
    }

    /* invoke onSpawn */
    onSpawn(cmd, opt.user, runner.pid)

    /* pipe stdin into this process */
    process.stdin.pipe(stdin(runner))

    /* output std & stderr */
    stdout(runner).on('data', stdlog)
    stderr(runner).on('data', stdlog)

    /* error handler for std & stderr */
    stdout(runner).on('error', function () {})
    stderr(runner).on('error', function () {})
    stdin(runner).on('error', function () {})

    /* on exit ... */
    runner.on('exit', async function (exitcode) {
      process.stdin.unpipe(stdin(runner))
      process.stdin.resume()
      process.stdin.pause()

      /* get updated environment variables */
      const env_file_path = tmpdir + `/env-pid${runner.pid}.log`
      const envs = await cfg_ldr.load_env([env_file_path])

      /* callback after environment variables are updated */
      onExit && onExit(cmd, exitcode, true, envs)

      /* return both exitcode and environment variables */
      resolve(exitcode)
    })
  })
}

function parse_exec(input)
{
  if (input === undefined)
    return ''
  else if (Array.isArray(input))
    return input.join('; ')
  else
    return input.replace(/\n/g, '; ')
}

exports.runjob = async function (run_cfg, jobname, onSpawn, onExit, onLog, onTestFail) {
  const targetProps = run_cfg.jobs.getNodeData(jobname)
  const cmd = parse_exec(targetProps['exec'])
  const cwd = targetProps['cwd'] || '.'
  const user = targetProps['user'] || 'current'
  const spawn = targetProps['spawn'] || 'direct'
  const source = targetProps['source']

  if (cmd === '') {
    onExit(cmd, 0, false, run_cfg.envs)
    return
  }

  /* prepare spawn environment */
  var allEnv = {
    'PATH': process.env['PATH'],
    'USER': user,
    'USERNAME': user,
    'HOME': (user == 'root') ? '/root' : '/home/' + user,
    'SHELL': '/bin/sh'
  }

  const jobEnv = run_cfg.envs || {}
  allEnv = extend(allEnv, jobEnv)

  if (source) {
    const importEnv = await cfg_ldr.load_env(source, allEnv)
    console.log(importEnv)
    extend(allEnv, importEnv)
  }

  const opts = {
    'env': allEnv,
    'cwd': cwd,
    'user': user,
    'group': user,
    'spawn': spawn
  }

  try {

    /* main command */
    if (targetProps['if']) {
      const ifcmd = targetProps['if']
      const exitcode = await exports.runcmd(ifcmd, opts, onLog, onSpawn, (_cmd, _, __) => {
        onExit(_cmd, 0 /* keep successful for test command */, false, run_cfg.envs)
      })

      if (exitcode != 0) {
        onTestFail()
        return
      }

    } else if (targetProps['if_not']) {
      const incmd = targetProps['if_not']
      const exitcode = await exports.runcmd(incmd, opts, onLog, onSpawn, (_cmd, _, __) => {
        onExit(_cmd, 0 /* keep successful for test command */, false, run_cfg.envs)
      })

      if (exitcode == 0) {
        onTestFail()
        return
      }
    }

    /* main command */
    await exports.runcmd(cmd, opts, onLog, onSpawn, onExit)

  } catch (err) {
    console.error('[Error]', err.toString())
  }

}

exports.runlist = function (run_cfg, runList, onComplete) {
  let failcnt = 0

  /* start task */
  const list_job_names = runList.join(', ')
  const task_id = tasks.add_task(runList, run_cfg.status)

  logAndPrint(
    `[ job-runner ] start task: ${list_job_names}.`,
    ['MASTER', `task-${task_id}`]
  )

  logAndPrint(
    `[ job-runner ] task ID: ${task_id}, envs: ` + JSON.stringify(run_cfg.envs),
    ['MASTER', `task-${task_id}`]
  )

  /* main loop */
  exports.syncLoop(runList,

    /* doing loop */
    function (_, idx, loop) {
      let jobname = runList[idx]
      let props = run_cfg.jobs.getNodeData(jobname)

      /* recursive calling runlist for ref jobs */
      let ref = props['ref']
      if (ref) {
        let subList = exports.getRunList(run_cfg.jobs, ref)
        exports.runlist(run_cfg, subList, (completed) => {
          if (completed)
            loop.next()
          else
            loop.brk()
        })
        return
      }

      /* prepare process callbacks */
      const onLog = function (lines) {
        const line_arr = lines.split('\n')
        line_arr.forEach(function (line) {
          logAndPrint(line, ['MASTER', `job-${jobname}`, `task-${task_id}`])
        })
      }

      const onSpawn = function (cmd, usr, pid) {
        onLog(`[ spawn by ${usr}, pid=${pid} ] ${jobname}`)
        onLog(`[ ${jobname} ] ${cmd}`)

        /* update task meta info */
        tasks.spawn_notify(task_id, idx, run_cfg.envs, pid)
      }

      const onExit = function (cmd, exitcode, retry, envs) {
        onLog(`[ exitcode = ${exitcode} ] ${jobname}`)

        /* carray updated environment variables */
        run_cfg.envs = envs

        /* update task meta info */
        tasks.exit_notify(task_id, idx, run_cfg.envs, exitcode)

        if (retry && !run_cfg.status) {
          if (exitcode == 0) {
            failcnt = 0
            setTimeout(loop.next, 500)

          } else {
            failcnt ++
            onLog(`[ Fails ] ${failcnt} times.`)

            if (failcnt >= 3) {
              loop.brk()
            } else {
              setTimeout(loop.again, 500)
            }
          }
        } else {
          setTimeout(loop.next, 500)
        }
      }

      if (run_cfg.dryrun) {
        const targetProps = run_cfg.jobs.getNodeData(jobname)
        const cmd = parse_exec(targetProps['exec'])

        onLog(`[ dry run ] ${jobname}`)
        onSpawn(cmd, 'dry', -1)
        onExit(cmd, 0, false, {})
        return
      }

      exports.runjob(run_cfg, jobname, onSpawn, onExit, onLog, function () {
        onLog(`[ test failed ] ${jobname}`)
        loop.next()
      })
    },

    /* done loop */
    function (_, idx, loop, completed) {
      logAndPrint(
        `[ job-runner ] finished task#${task_id} (${completed}): ${list_job_names}.`,
        ['MASTER', `task-${task_id}`]
      )
      onComplete && onComplete(completed)
    }
  )

  return task_id
}

function envAddTargetArgs(envs, target) {
  const args = target.split('?')
  if (args.length > 1) {
    const argEnvs = querystring.parse(args[1])
    extend(envs, argEnvs)
  }
  return args[0]
}

exports.run = function (run_cfg, onComplete) {
  /* list dependent jobs and parse target parameters, if any */
  const target = envAddTargetArgs(run_cfg.envs, run_cfg.target)

  /* safe-guard some keys */
  run_cfg.dryrun = run_cfg.dryrun || false
  run_cfg.status = run_cfg.status || false
  run_cfg.single = run_cfg.single || false

  var runList
  if (run_cfg.single)
    runList = [target]
  else
    runList = exports.getRunList(run_cfg.jobs, target)

  const task_id = exports.runlist(run_cfg, runList, onComplete)
  return {task_id, runList}
}

if (require.main === module) {
  ;(async function () {
    const jobs = await cfg_ldr.load_jobs('./test-jobs')
    const cfgs = await cfg_ldr.load_cfg('./config.template.toml')

    const target = 'goodbye:talk-later?later_hours=2&reason="I am heading for a meeting"'

    const run_cfg = {
      jobs: jobs,
      envs: cfgs.env,
      target: target
    }

    const ret = exports.run(run_cfg, async function (completed) {
      console.log(JSON.stringify(tasks.get(ret.task_id)))
    })
    console.log(ret)

  })()
}

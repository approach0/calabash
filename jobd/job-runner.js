const os = require('os')
const fs = require('fs')
const cfg_ldr = require('./cfg-ldr.js')
const logger = require('./logger.js')
const tasks = require('./tasks.js')
const process_ = require('process')
const pty = require('node-pty-prebuilt-multiarch')
const childProcess = require('child_process')
const querystring = require('querystring')

function logAndPrint(line, logIDs) {
  [...logIDs, 'MASTER'].forEach(logID => {
    logger.write(logID, line)
  })

  const fixed = (len, input) => {
    return (input.length > len - 3) ? `${input.substring(0, len - 3)}...` : input.padEnd(len)
  }

  console.log(fixed(30, logIDs.join(',')) + ' |', line)
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

  setTimeout(() => {
    loop.again()
  }, 0)
}

exports.getRunList = function (jobs, target) {
  const deps = jobs.dependenciesOf(target)
  deps.push(target)
  return deps
}

exports.runcmd = function (cmd, opt, onLog, onSpawn)
{
  /* choose between pty.spawn and childProcess.spawn */
  let spawnFun = pty.spawn
  let stdout = function (o) {return o}
  let stderr = function (o) {return {'on': function (d) {}}}
  let stdin  = function (o) {return o}
  let stdlog = function (o) {onLog(o, true)}

  if (opt.spawn == 'direct') {
    spawnFun = childProcess.spawn
    stdout = function (o) {return o.stdout}
    stderr = function (o) {return o.stderr}
    stdin  = function (o) {return o.stdin}
    stdlog = function (o) {onLog(o.toString(), true)}
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
    //console.log(opt.env_declare)
    try {
      const hooked_cmd =
      opt.env_declare +
      `__on_exit__() {
        exitcode=$?
        ${opt.verbose ? '{ set +x; } 2> /dev/null' : ''}
        declare -x > ${tmpdir}/env-pid$$.log
        declare -fx >> ${tmpdir}/env-pid$$.log
        exit $exitcode
      }\n` +
      'trap __on_exit__ EXIT \n' +
       (opt.verbose ? 'set -x \n' : '') +
       cmd;

      //console.log(hooked_cmd)

      runner = spawnFun('/bin/bash', ['-c', hooked_cmd], {
        uid, gid,
        'cwd': opt.cwd,
        'env': opt.env_basic,
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

      resolve([runner.pid, exitcode])
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

exports.runjob = async function (run_cfg, jobname, onSpawn, onExit, onLog) {
  const targetProps = run_cfg.jobs.getNodeData(jobname)
  const cmd = parse_exec(targetProps['exec'])
  const cwd = targetProps['cwd'] || '.'
  const user = targetProps['user'] || 'current'
  const spawn = targetProps['spawn'] || 'direct'
  const ifcmd = (targetProps['if'] === undefined) ? null : String(targetProps['if'])
  const incmd = (targetProps['if_not'] === undefined) ? null : String(targetProps['if_not'])
  const verbose = targetProps['verbose'] || false

  if (cmd === '') {
    onExit(cmd, -1, 0)
    return
  }

  /* prepare spawn environment */
  var basicEnv = {
    'PATH': process.env['PATH'],
    'USER': user,
    'USERNAME': user,
    'HOME': (user == 'root') ? '/root' : '/home/' + user,
    'SHELL': '/bin/sh'
  }

  const opts = {
    'env_basic': basicEnv,
    'env_declare': run_cfg.envs,
    'verbose': verbose,
    'cwd': cwd,
    'user': user,
    'group': user,
    'spawn': spawn
  }

  try {

    /* main command */
    if (typeof ifcmd === 'string') {
      onLog(`[IF ${ifcmd}] ${cmd}`)
      const [pid, exitcode] = await exports.runcmd(ifcmd, opts, onLog, onSpawn)

      if (exitcode != 0) {
        onExit(ifcmd, pid, exitcode, 'treat_as_success')
        return
      } else {
        onExit(ifcmd, pid, exitcode, 'no_loop_ctrl')
      }

    } else if (typeof incmd === 'string') {
      onLog(`[IF NOT ${incmd}] ${cmd}`)
      const [pid, exitcode] = await exports.runcmd(incmd, opts, onLog, onSpawn)

      if (exitcode == 0) {
        onExit(incmd, pid, exitcode, 'treat_as_success')
        return
      } else {
        onExit(incmd, pid, exitcode, 'no_loop_ctrl')
      }
    }

    /* main command */
    const [pid, exitcode] = await exports.runcmd(cmd, opts, onLog, onSpawn)
    onExit(cmd, pid, exitcode)

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
    `[ job-runner ] start task#${task_id}: ${list_job_names}.`,
    [`task-${task_id}`]
  )

  /* main loop */
  exports.syncLoop(runList,

    /* doing loop */
    function (_, idx, loop) {
      let jobname = runList[idx]
      let props = run_cfg.jobs.getNodeData(jobname)

      /* prepare process callbacks */
      const onLog = function (lines, pure_cmd_output) {
        const line_arr = lines.split('\n')
        line_arr.forEach(function (line) {
          logAndPrint(line, [`job-${jobname}`, `task-${task_id}`])
        })

        if (pure_cmd_output || false) {
          tasks.log_notify(task_id, idx, lines)
        }
      }

      const onSpawn = function (cmd, usr, pid) {
        onLog(`[ spawn pid=${pid} ] ${cmd}`, false)

        /* update task meta info */
        tasks.spawn_notify(task_id, idx, pid)
      }

      const onExit = async function (cmd, pid, _exitcode, flag) {
        onLog(`[ exitcode = ${_exitcode} ] ${cmd}`)

        /* update task meta info */
        const exitcode = (flag === 'treat_as_success') ? 0 : _exitcode
        tasks.exit_notify(task_id, idx, exitcode)

        if (flag === 'no_loop_ctrl')
          return

        /* get updated environment variables */
        const env_file_path = os.tmpdir() + `/env-pid${pid}.log`
        run_cfg.envs = await fs.readFileSync(env_file_path, 'utf-8')

        if (!run_cfg.status) {
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

      onLog(`[ job ] ${jobname} of task#${task_id}`)

      /* handle dryrun and reference */
      let ref = props['ref']
      if (run_cfg.dryrun) {
        const targetProps = run_cfg.jobs.getNodeData(jobname)
        const cmd = parse_exec(targetProps['exec'])

        onSpawn(cmd, 'dry', -1)
        onExit(cmd, -1, 0)
        return

      } else if (ref) {
        let subList = exports.getRunList(run_cfg.jobs, ref)
        exports.runlist(run_cfg, subList, (completed) => {
          if (completed)
            loop.next()
          else
            loop.brk()
        })
        return
      }

      exports.runjob(run_cfg, jobname, onSpawn, onExit, onLog)
    },

    /* done loop */
    function (_, idx, loop, completed) {
      logAndPrint(
        `[ job-runner ] finished task#${task_id} (${completed}): ${list_job_names}.`,
        [`task-${task_id}`]
      )
      onComplete && onComplete(completed)
    }
  )

  return task_id
}

/* declare non-functional env variables */
exports.declare_envs = function (env) {
  return Object.keys(env).reduce((accum, key) => {
    return accum + `declare -x ${key}="${env[key]}"\n`
  }, '')
}

exports.parseTargetArgs = function (target) {
  const args = target.split('?')
  if (args.length > 1) {
    const argEnv = querystring.parse(args[1])
    return [args[0], argEnv]
  } else {
    return [args[0], {}]
  }
}

exports.run = function (run_cfg, onComplete) {
  /* safe-guard some keys */
  run_cfg.dryrun = run_cfg.dryrun || false
  run_cfg.status = run_cfg.status || false
  run_cfg.single = run_cfg.single || false

  var runList
  if (run_cfg.single)
    runList = [run_cfg.target]
  else
    runList = exports.getRunList(run_cfg.jobs, run_cfg.target)

  const task_id = exports.runlist(run_cfg, runList, onComplete)
  return {task_id, runList}
}

if (require.main === module) {
  ;(async function () {
    const jobs = await cfg_ldr.load_jobs('./test-jobs')
    const cfgs = await cfg_ldr.load_cfg('./config.template.toml')

    const [target, env] = exports.parseTargetArgs('goodbye:talk-later?later_hours=2&reason=I am heading for a meeting')
    const envs = exports.declare_envs(cfgs.env) + exports.declare_envs(env)

    const run_cfg = {
      jobs: jobs,
      envs: envs ,
      target: target
    }

    const ret = exports.run(run_cfg, async function (completed) {
      console.log(JSON.stringify(tasks.get(ret.task_id)))
    })
    console.log(ret)

  })()
}

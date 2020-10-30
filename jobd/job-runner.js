const os = require('os')
const fs = require('fs')
const cfg_ldr = require('./cfg-ldr.js')
const logger = require('./logger.js')
const tasks = require('./tasks.js')
const process_ = require('process')
const pty = require('node-pty-prebuilt-multiarch')
const childProcess = require('child_process')
const querystring = require('querystring')

const logHeaderLen = 32
const onelineCmdLen = 128

function fixedWidth(len, input) {
  return (input.length > len - 3) ? `${input.substring(0, len - 3)}...` : input.padEnd(len)
}

function logAndPrintLine(line, logIDs) {
  const info = fixedWidth(logHeaderLen, logIDs.join(', ')) + ' |';

  /* log to file */
  [...logIDs, 'MASTER'].forEach(logID => {
    logger.write(logID, info + line)
  })

  /* print to stdout */
  console.log(info, line)
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
    },

    restart: function () {
      idx = 0
      loop.again()
    }
  }

  setTimeout(() => {
    loop.again()
  }, 0)
}

/* declare non-functional env variables */
exports.declare_envs = function (env) {
  return Object.keys(env).reduce((accum, key) => {
    const value = String(env[key]).replace(/'/g, "'\\''")
    return accum + `declare -x ${key}='${value}'\n`
  }, '')
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

  /* overwrite/necessary environment */
  const ow_declare = exports.declare_envs({
    'PATH': process.env['PATH'],
    'USER': opt.user,
    'TERM': 'xterm-256color',
    'USERNAME': opt.user,
    'HOME': (opt.user == 'root') ? '/root' : '/home/' + opt.user,
    'SHELL': '/bin/sh'
  })

  return new Promise((resolve, reject) => {
    /* spawn runner process */
    let runner
    const tmpdir = os.tmpdir()
    try {
      const hooked_cmd =
      opt.declare +
      ow_declare +
      `__on_exit__() {
        exitcode=$?
        ${opt.source ? '{ set +a; } 2> /dev/null' : ''}
        ${opt.verbose ? '{ set +x; } 2> /dev/null' : ''}
        declare -x > ${tmpdir}/env-pid$$.log
        declare -fx >> ${tmpdir}/env-pid$$.log
        exit $exitcode
      }\n` +
      'trap __on_exit__ EXIT \n' +
       (opt.verbose ? 'set -x \n' : '') +
       (opt.source ? 'set -a \n' : '') +
       cmd;

      //console.log(opt.declare)
      //console.log(ow_declare)
      //console.log(hooked_cmd)
      runner = spawnFun('/bin/bash', ['-c', hooked_cmd], {
        uid, gid,
        'cwd': opt.cwd,
        'env': {},
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
  if (input === undefined) {
    return ''
  } else if (Array.isArray(input)) {
    const trim_in = input.map(s => s.trim())
    return trim_in.join('\n')
  } else {
    return input
  }
}

exports.runjob = async function (run_cfg, jobname, onSpawn, onExit, onLog) {
  const targetProps = run_cfg.jobs.getNodeData(jobname)
  const source = parse_exec(targetProps['source'])
  const cmd = parse_exec(targetProps['exec'])
  const cwd = targetProps['cwd'] || '.'
  const user = targetProps['user'] || 'current'
  const spawn = targetProps['spawn'] || 'direct'
  const ifcmd = (targetProps['if'] === undefined) ? null : String(targetProps['if'])
  const incmd = (targetProps['if_not'] === undefined) ? null : String(targetProps['if_not'])
  const verbose = targetProps['verbose'] || false

  /* prepare spawn environment */
  const opts = {
    'declare': run_cfg.envs,
    'verbose': verbose,
    'cwd': cwd,
    'user': user,
    'group': user,
    'spawn': spawn
  }

  try {
    /* source command */
    if (source) {
      const source_opts = Object.assign({source: true}, opts)
      const [pid, exitcode] = await exports.runcmd(source, source_opts, onLog, onSpawn)
      await onExit(source, pid, exitcode, 'no_loop_ctrl')

      /* update environment variables */
      opts.declare = run_cfg.envs
    }

    /* test command */
    if (typeof ifcmd === 'string') {
      onLog(`[ if ${ifcmd} ] ${ifcmd}`)
      const [pid, exitcode] = await exports.runcmd(ifcmd, opts, onLog, onSpawn)

      if (exitcode != 0) {
        onExit(ifcmd, pid, exitcode, 'treat_as_success')
        return
      } else {
        onExit(ifcmd, pid, exitcode, 'no_loop_ctrl')
      }

    } else if (typeof incmd === 'string') {
      onLog(`[ if not ${incmd} ] ${incmd}`)
      const [pid, exitcode] = await exports.runcmd(incmd, opts, onLog, onSpawn)

      if (exitcode == 0) {
        onExit(incmd, pid, exitcode, 'treat_as_success')
        return
      } else {
        onExit(incmd, pid, exitcode, 'no_loop_ctrl')
      }
    }

    /* main command */
    if (cmd) {
      const [pid, exitcode] = await exports.runcmd(cmd, opts, onLog, onSpawn)
      onExit(cmd, pid, exitcode)
    } else {
      onExit(cmd, -1, 0)
    }

  } catch (err) {
    console.error('[Error]', err.toString())
  }

}

exports.runlist = function (run_cfg, runList, onComplete) {
  let failcnt = 0

  /* start task */
  const list_job_names = runList.join(', ')
  const task_id = tasks.add_task(runList, run_cfg.pin_id)

  logAndPrintLine(
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
      const onLog = function (lines, is_exec_output) {
        const line_arr = lines.split('\n')

        if (is_exec_output || false) {
          // save to task-wise prue log
          tasks.log_notify(task_id, idx, lines)

          // pop the trailing field, if it contains anything, push back.
          const last = line_arr.pop()
          last !== '' && line_arr.push(last)
        }
        line_arr.forEach(function (line) {
          logAndPrintLine(line, [`task-${task_id}`, `job-${jobname}`])
        })
      }

      const onSpawn = function (cmd, usr, pid) {
        const onelinecmd = fixedWidth(onelineCmdLen, cmd.replace(/\n/g, "; "))
        onLog(`[ spawn pid=${pid}, user=${usr} ] ${onelinecmd}`)

        /* update task meta info */
        tasks.spawn_notify(task_id, idx, pid)
      }

      const onExit = async function (cmd, pid, _exitcode, flag) {
        const onelinecmd = fixedWidth(onelineCmdLen, cmd.replace(/\n/g, "; "))
        onLog(`[ exitcode = ${_exitcode} ] ${onelinecmd}`)

        /* update task meta info */
        const exitcode = (flag === 'treat_as_success') ? 0 : _exitcode
        tasks.exit_notify(task_id, idx, exitcode)

        /* get updated environment variables */
        const env_file_path = os.tmpdir() + `/env-pid${pid}.log`
        try {
          run_cfg.envs = await fs.readFileSync(env_file_path, 'utf-8')
        } catch (_) {
          /* for mock-up processes, we do not expect a valid pid number */
          ;
        }

        if (flag === 'no_loop_ctrl')
          return

        if (!run_cfg.insist) {
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

      onLog(`[ start job ] ${jobname} of task#${task_id}`)

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
          if (completed && !run_cfg.insist)
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
      logAndPrintLine(
        `[ job-runner ] finished task#${task_id} (${completed}): ${list_job_names}.`,
        [`task-${task_id}`]
      )

      /* loop a status task */
      if (run_cfg.pin_id > 0) {
        setTimeout(loop.restart, run_cfg.reborn)
      }

      onComplete && onComplete(completed)
    }
  )

  return task_id
}

exports.parseTargetArgs = function (target) {
  const args = target.split('?')
  if (args.length > 1) {
    let argEnv = querystring.parse(args[1])

    // get rid of [Object: null prototype]
    argEnv = JSON.parse(JSON.stringify(argEnv))

    return [args[0], argEnv]
  } else {
    return [args[0], {}]
  }
}

exports.run = function (run_cfg, onComplete) {
  /* safe-guard some keys */
  run_cfg.dryrun = run_cfg.dryrun || false
  run_cfg.insist = run_cfg.insist || false
  run_cfg.single = run_cfg.single || false
  run_cfg.pin_id = run_cfg.pin_id || -1
  run_cfg.reborn = run_cfg.reborn || 0

  var runList
  if (run_cfg.single)
    runList = [run_cfg.target]
  else
    runList = exports.getRunList(run_cfg.jobs, run_cfg.target)

  console.log(runList)

  const task_id = exports.runlist(run_cfg, runList, onComplete)
  return {task_id, runList}
}

if (require.main === module) {
  ;(async function () {
    const jobs = await cfg_ldr.load_jobs('./test-jobs')
    const [cfgs, _] = await cfg_ldr.load_cfg('./config.template.toml')

    const [target, args] = exports.parseTargetArgs('goodbye:talk-later?later_hours=3')
    const envObj = Object.assign(cfgs, args) // overwrite/merge into default configs
    const envs = exports.declare_envs(envObj)

    const run_cfg = {
      jobs: jobs,
      envs: envs,
      target: target
    }

    const ret = exports.run(run_cfg, async function (completed) {
      console.log(JSON.stringify(tasks.get(ret.task_id)))
    })
    console.log(ret)

  })()
}

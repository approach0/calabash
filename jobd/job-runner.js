const cfg_ldr = require('./cfg-ldr.js')
const logger = require('./logger.js')
const tasks = require('./tasks.js')
const extend = require('util')._extend
const process_ = require('process')
const pty = require('node-pty-prebuilt-multiarch')
const childProcess = require('child_process')
const os = require('os')

function masterLog(line) {
  logger.write('_master_', line)
  console.log(line)
}

function slaveLog(jobname, line) {
  logger.write(jobname, line)
  logger.write('_master_', line)
  console.log(jobname + ' |', line)
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

exports.getRunList = async function (jobs, target) {
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

      /* callback */
      onExit && onExit(cmd, exitcode, true)

      /* get updated environment variables */
      const env_file_path = tmpdir + `/env-pid${runner.pid}.log`
      const envs = await cfg_ldr.load_env(env_file_path)

      /* return both exitcode and environment variables */
      resolve([exitcode, envs])
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

exports.runjob = async function (run_cfg, jobname, onSpawn, onExit, next) {
  const targetProps = run_cfg.jobs.getNodeData(jobname)
  const cmd = parse_exec(targetProps['exec'])
  const cwd = targetProps['cwd'] || '.'
  const user = targetProps['user'] || 'current'
  const spawn = targetProps['spawn'] || 'direct'

  if (cmd === '') {
    onExit(cmd, 0, false)
    return
  }

  /* prepare spawn environment */
  const onLog = function (lines) {
    const line_arr = lines.split('\n')
    line_arr.forEach(function (line) {
      slaveLog(jobname, line)
    })
  }

  const defaultEnv = {
    'PATH': process.env['PATH'],
    'USER': user,
    'USERNAME': user,
    'HOME': (user == 'root') ? '/root' : '/home/' + user,
    'SHELL': '/bin/sh'
  }
  const jobEnv = run_cfg.envs || {}
  const allEnv = extend(defaultEnv, jobEnv)

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
      const [exitcode, _] = await exports.runcmd(ifcmd, opts, onLog, onSpawn, (_cmd, _, __) => {
        onExit(_cmd, 0 /* keep successful for test command */, false)
      })

      if (exitcode != 0) {
        next()
        return
      }

    } else if (targetProps['if_not']) {
      const incmd = targetProps['if_not']
      const [exitcode, _] = await exports.runcmd(incmd, opts, onLog, onSpawn, (_cmd, _, __) => {
        onExit(_cmd, 0 /* keep successful for test command */, false)
      })

      if (exitcode == 0) {
        next()
        return
      }
    }

    /* main command */
    const [_, envs] = await exports.runcmd(cmd, opts, onLog, onSpawn, onExit)

    /* update environment variables */
    run_cfg.envs = envs

  } catch (err) {
    console.error('[Error]', err.toString())
  }

}

exports.runlist = async function (run_cfg, runList, _dryrun, _status, onComplete) {
  const dryrun = _dryrun || false
  const status = _status || false
  let failcnt = 0

  /* start task */
  {
    let list_job_names = runList.join(', ')
    masterLog(`[ job-runner ] start task: ${list_job_names}.`)
  }

  const task_id = await tasks.add_task(runList, status)
  console.log(`[ job-runner ] task ID: ${task_id}`)

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
        exports.runlist(run_cfg, subList, dryrun, status, (completed) => {
          if (completed)
            loop.next()
          else
            loop.brk()
        })
        return
      }

      /* prepare process callbacks */
      const onSpawn = function (cmd, usr, pid) {
        slaveLog(jobname, `[ spawn by ${usr}, pid=${pid} ] ${jobname}`)
        slaveLog(jobname, `[ ${jobname} ] ${cmd}`)
        tasks.spawn_notify(task_id, idx, pid) /* update task meta info */
      }

      const onExit = function (cmd, exitcode, retry) {
        slaveLog(jobname, `[ exitcode = ${exitcode} ] ${jobname}`)
        tasks.exit_notify(task_id, idx, exitcode) /* update task meta info */

        if (retry && !status) {
          if (exitcode == 0) {
            failcnt = 0
            setTimeout(loop.next, 500)

          } else {
            failcnt ++
            slaveLog(jobname, `[ Fails ] ${failcnt} times.`)

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

      if (dryrun) {
        const targetProps = run_cfg.jobs.getNodeData(jobname)
        const cmd = parse_exec(targetProps['exec'])

        slaveLog(jobname, `[ dry run ] ${jobname}`)
        onSpawn(cmd, 'dry', -1)
        onExit(cmd, 0, false)
        return
      }

      exports.runjob(run_cfg, jobname, onSpawn, onExit, function () {
        slaveLog(jobname, `[ test failed ] ${jobname}`)
        loop.next()
      })
    },

    /* done loop */
    function (_, idx, loop, completed) {
      let list_job_names = runList.join(', ')
      masterLog(`[ finished (${completed}) ] ${list_job_names}.`)
      onComplete && onComplete(completed)
    }
  )

  return task_id
}

if (require.main === module) {
  ;(async function () {
    const jobs = await cfg_ldr.load_jobs('./test-jobs')
    const cfgs = await cfg_ldr.load_cfg('./config.template.toml')
    const run_cfg = {jobs, envs: cfgs.env}

    const runList = await exports.getRunList(jobs, 'goodbye:talk-later')
    console.log(runList)

    exports.runlist(run_cfg, runList, 0, 0, async function (completed) {
      console.log(JSON.stringify(await tasks.get_list()))
    })

  })()
}

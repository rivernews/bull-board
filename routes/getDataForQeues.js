const { pick, isEmpty } = require('ramda')

const metrics = [
  'redis_version',
  'used_memory',
  'mem_fragmentation_ratio',
  'connected_clients',
  'blocked_clients',
]

async function getStats(queue) {
  await queue.client.info()

  const validMetrics = pick(metrics, queue.client.serverInfo)
  validMetrics.total_system_memory =
    queue.client.serverInfo.total_system_memory ||
    queue.client.serverInfo.maxmemory

  return validMetrics
}

const formatJob = job => {
  return {
    id: job.id,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    progress: job._progress,
    attempts: job.attemptsMade,
    delay: job.delay,
    failedReason: job.failedReason,
    stacktrace: job.stacktrace,
    opts: job.opts,
    data: job.data,
  }
}

const statuses = [
  'active',
  'waiting',
  'completed',
  'failed',
  'delayed',
  'paused',
]

module.exports = async function getDataForQeues({ queues, query = {} }) {
  if (isEmpty(queues)) {
    return { stats: {}, queues: [] }
  }

  console.log('query', query)

  const pairs = Object.entries(queues)

  const counts = await Promise.all(
    pairs.map(async ([name, queue]) => {
      const counts = await queue.getJobCounts()

      let jobs = []
      if (name) {
        const status = query[name] === 'latest' ? statuses : query[name]
        let start = 0
        let end = 10
        if (query.start && query.end) {
          const parsedStart = parseInt(query.start)
          const parsedEnd = parseInt(query.end)
          if (parsedStart !== NaN) {
            start = parsedStart
          }
          if (parsedEnd !== NaN) {
            end = parsedEnd
          }
        }
        jobs = await queue.getJobs(status, start, end)
      }

      return {
        name,
        counts,
        jobs: jobs.map(formatJob),
      }
    }),
  )
  const stats = await getStats(pairs[0][1])

  return { stats, queues: counts }
}
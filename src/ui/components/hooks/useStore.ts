import { useEffect, useRef, useState } from 'react'
import qs from 'querystring'
import { Status } from '../constants'
import * as api from '../../../@types/api'
import { AppQueue, AppJob, PaginationParameters } from '../../../@types/app'

const interval = 5000

type State = {
  data: null | api.GetQueues
  loading: boolean
}

type SelectedStatuses = Record<AppQueue['name'], Status>

export interface Store {
  state: State
  promoteJob: (queueName: string) => (job: AppJob) => () => Promise<void>
  retryJob: (queueName: string) => (job: AppJob) => () => Promise<void>
  retryAll: (queueName: string) => () => Promise<void>
  cleanAllDelayed: (queueName: string) => () => Promise<void>
  cleanAllFailed: (queueName: string) => () => Promise<void>
  cleanAllCompleted: (queueName: string) => () => Promise<void>
  selectedStatuses: SelectedStatuses
  setSelectedStatuses: React.Dispatch<React.SetStateAction<SelectedStatuses>>
  pagination: PaginationParameters
  setPagination: React.Dispatch<React.SetStateAction<PaginationParameters>>
}

export const useStore = (basePath: string): Store => {
  const [state, setState] = useState({
    data: null,
    loading: true,
  } as State)
  const [selectedStatuses, setSelectedStatuses] = useState(
    {} as SelectedStatuses,
  )
  const [pagination, setPagination] = useState<PaginationParameters>({
    start: 0,
    end: 9,
  })

  const poll = useRef(undefined as undefined | NodeJS.Timeout)
  const stopPolling = () => {
    if (poll.current) {
      clearTimeout(poll.current)
      poll.current = undefined
    }
  }

  useEffect(() => {
    stopPolling()
    runPolling()

    return stopPolling
  }, [selectedStatuses, pagination])

  const runPolling = () => {
    update()
      .catch(error => console.error('Failed to poll', error))
      .then(() => {
        const timeoutId = setTimeout(runPolling, interval)
        poll.current = timeoutId
      })
  }

  const update = () =>
    fetch(`${basePath}/queues/?${qs.encode(Object.entries(selectedStatuses).length ? {
      ...selectedStatuses,
      ...pagination,
    } : {})}`)
      .then(res => (res.ok ? res.json() : Promise.reject(res)))
      .then(data => setState({ data, loading: false }))

  const promoteJob = (queueName: string) => (job: AppJob) => () =>
    fetch(
      `${basePath}/queues/${encodeURIComponent(queueName)}/${job.id}/promote`,
      {
        method: 'put',
      },
    ).then(update)

  const retryJob = (queueName: string) => (job: AppJob) => () =>
    fetch(
      `${basePath}/queues/${encodeURIComponent(queueName)}/${job.id}/retry`,
      {
        method: 'put',
      },
    ).then(update)

  const retryAll = (queueName: string) => () =>
    fetch(`${basePath}/queues/${encodeURIComponent(queueName)}/retry`, {
      method: 'put',
    }).then(update)

  const cleanAllDelayed = (queueName: string) => () =>
    fetch(`${basePath}/queues/${encodeURIComponent(queueName)}/clean/delayed`, {
      method: 'put',
    }).then(update)

  const cleanAllFailed = (queueName: string) => () =>
    fetch(`${basePath}/queues/${encodeURIComponent(queueName)}/clean/failed`, {
      method: 'put',
    }).then(update)

  const cleanAllCompleted = (queueName: string) => () =>
    fetch(
      `${basePath}/queues/${encodeURIComponent(queueName)}/clean/completed`,
      {
        method: 'put',
      },
    ).then(update)

  return {
    state,
    promoteJob,
    retryJob,
    retryAll,
    cleanAllDelayed,
    cleanAllFailed,
    cleanAllCompleted,
    selectedStatuses,
    setSelectedStatuses,
    pagination,
    setPagination,
  }
}

import { useCallback, useRef, useState } from 'react'

type Ops<T> = {
  fetch: () => Promise<T[]>
  add: (input: Partial<T>) => Promise<void>
  edit: (record: T) => Promise<void>
  remove: (record: T) => Promise<void>
}

type UseRecordOpsResult<T> = {
  openAdd: () => void
  openEdit: (record: T) => void
  confirmDelete: (record: T) => void
  refresh: () => Promise<T[]>
  editing: T | null
  adding: boolean
  deleting: T | null
  closeAll: () => void
}

export function useRecordOps<T>(ops: Ops<T>): UseRecordOpsResult<T> {
  const [editing, setEditing] = useState<T | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<T | null>(null)
  const pendingRefresh = useRef<Promise<T[]> | null>(null)

  const refresh = useCallback(async () => {
    const p = ops.fetch()
    pendingRefresh.current = p
    const res = await p
    pendingRefresh.current = null
    return res
  }, [ops])

  const closeAll = useCallback(() => {
    setEditing(null)
    setAdding(false)
    setDeleting(null)
  }, [])

  const openAdd = useCallback(() => {
    setAdding(true)
  }, [])

  const openEdit = useCallback((record: T) => {
    setEditing(record)
  }, [])

  const confirmDelete = useCallback((record: T) => {
    setDeleting(record)
  }, [])

  return {
    openAdd,
    openEdit,
    confirmDelete,
    refresh,
    editing,
    adding,
    deleting,
    closeAll,
  }
}


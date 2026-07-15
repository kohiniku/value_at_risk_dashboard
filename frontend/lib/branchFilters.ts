'use client'

export type BranchFilterCondition = {
  entity_name?: string
  dept_name?: string
  section_code?: string
  product?: string
}

type LegacyBranchFilter = {
  entity_name?: string | string[]
  dept_name?: string | string[]
  section_code?: string | string[]
  product?: string | string[]
}

const CONDITION_KEYS: Array<keyof BranchFilterCondition> = ['entity_name', 'dept_name', 'section_code', 'product']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeLegacyToConditions = (legacy: LegacyBranchFilter): BranchFilterCondition[] => {
  let acc: BranchFilterCondition[] = [{}]

  for (const key of CONDITION_KEYS) {
    const raw = legacy[key]
    if (!raw) {
      continue
    }
    const values = Array.isArray(raw) ? raw : [raw]
    const next: BranchFilterCondition[] = []
    for (const base of acc) {
      for (const val of values) {
        if (typeof val !== 'string' || !val.trim()) {
          continue
        }
        next.push({ ...base, [key]: val })
      }
    }
    acc = next.length ? next : acc
  }

  return acc.filter((c) => CONDITION_KEYS.some((k) => Boolean(c[k])))
}

export const normalizeSelectedBranchToConditions = (selectedBranch: string): BranchFilterCondition[] | null => {
  if (!selectedBranch) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(selectedBranch)
    if (Array.isArray(parsed)) {
      const conditions: BranchFilterCondition[] = []
      for (const item of parsed) {
        if (!isRecord(item)) {
          continue
        }
        const cond: BranchFilterCondition = {}
        for (const key of CONDITION_KEYS) {
          const val = item[key]
          if (typeof val === 'string' && val.trim()) {
            cond[key] = val
          }
        }
        if (CONDITION_KEYS.some((k) => Boolean(cond[k]))) {
          conditions.push(cond)
        }
      }
      return conditions.length ? conditions : null
    }
    if (isRecord(parsed)) {
      return normalizeLegacyToConditions(parsed as LegacyBranchFilter)
    }
    return null
  } catch {
    return null
  }
}

export const appendBranchFiltersParam = (params: URLSearchParams, selectedBranch: string) => {
  const conditions = normalizeSelectedBranchToConditions(selectedBranch)
  if (!conditions) {
    return
  }
  params.append('branch_filters', JSON.stringify(conditions))
}


import { useState } from 'react'
import type { HealthIssue, HealthReport, HealthSeverity } from '@shared/types'
import { showError } from '../lib/errors'

const SEVERITY_LABEL: Record<HealthSeverity, string> = {
  error: '错误',
  warning: '警告',
  info: '提示'
}

const SEVERITY_CLASS: Record<HealthSeverity, string> = {
  error: 'text-rose-600 dark:text-rose-400',
  warning: 'text-amber-600 dark:text-amber-400',
  info: 'text-slate-500 dark:text-slate-400'
}

function SummaryChip({
  severity,
  count
}: {
  severity: HealthSeverity
  count: number
}): React.ReactElement | null {
  if (count === 0) return null
  return (
    <span className="tag">
      <span className={SEVERITY_CLASS[severity]}>{SEVERITY_LABEL[severity]}</span>
      <span className="ml-1">{count}</span>
    </span>
  )
}

export default function HealthSection(): React.ReactElement {
  const [report, setReport] = useState<HealthReport | null>(null)
  const [checking, setChecking] = useState(false)
  const [fixing, setFixing] = useState<string | null>(null)

  const check = async (): Promise<void> => {
    setChecking(true)
    try {
      setReport(await window.aibench.health.check())
    } catch (error) {
      showError(error, '健康检查失败')
    } finally {
      setChecking(false)
    }
  }

  const fix = async (issue: HealthIssue): Promise<void> => {
    setFixing(issue.id)
    try {
      setReport(await window.aibench.health.fix(issue.id))
    } catch (error) {
      showError(error, '修复失败')
    } finally {
      setFixing(null)
    }
  }

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950 dark:text-white">健康检查</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            检查 Framework 路径、Skill 文件、归档记录和 Prompt 数据库。检查本身不会修改任何内容。
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary shrink-0"
          disabled={checking}
          onClick={() => void check()}
        >
          {checking ? '检查中…' : report ? '重新检查' : '运行检查'}
        </button>
      </div>

      {report && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {report.summary.total === 0 ? (
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                未发现问题
              </span>
            ) : (
              <>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  共 {report.summary.total} 项
                </span>
                <SummaryChip severity="error" count={report.summary.errors} />
                <SummaryChip severity="warning" count={report.summary.warnings} />
                <SummaryChip severity="info" count={report.summary.infos} />
              </>
            )}
          </div>

          {report.issues.length > 0 && (
            <ul className="space-y-2">
              {report.issues.map((issue) => (
                <li
                  key={issue.id}
                  className="rounded-md border border-slate-300 p-3 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-xs font-semibold ${SEVERITY_CLASS[issue.severity]}`}
                        >
                          {SEVERITY_LABEL[issue.severity]}
                        </span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {issue.title}
                        </span>
                      </div>
                      {issue.detail && (
                        <p className="mt-1 break-all font-mono text-xs text-slate-500 dark:text-slate-400">
                          {issue.detail}
                        </p>
                      )}
                    </div>
                    {issue.fixable && (
                      <button
                        type="button"
                        className="btn-secondary shrink-0"
                        disabled={fixing !== null}
                        onClick={() => void fix(issue)}
                      >
                        {fixing === issue.id ? '修复中…' : '修复'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="text-xs text-slate-500 dark:text-slate-400">
            检查时间：{new Date(report.checkedAt).toLocaleString('zh-CN')}
          </p>
        </>
      )}
    </section>
  )
}

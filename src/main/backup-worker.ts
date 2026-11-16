import { parentPort, workerData } from 'node:worker_threads'
import { writeBackupZip, type BackupWriterInput } from './backup-writer'
import type { BackupWriterResult } from './backup-writer'

export type BackupWorkerMessage =
  | { ok: true; result: BackupWriterResult }
  | { ok: false; error: string }

const input = workerData as BackupWriterInput

let message: BackupWorkerMessage
try {
  message = { ok: true, result: writeBackupZip(input) }
} catch (error) {
  message = { ok: false, error: error instanceof Error ? error.message : String(error) }
}
parentPort?.postMessage(message)

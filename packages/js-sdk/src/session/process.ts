import { EnvVars } from './envVars'
import { SessionConnection } from './sessionConnection'

export const processService = 'process'

/**
 * A message from a process.
 */
export class ProcessMessage {
  constructor(
    public readonly line: string,
    /**
     * Unix epoch in nanoseconds
     */
    public readonly timestamp: number,
    public readonly error: boolean,
  ) {
    // eslint-disable-next-line prettier/prettier
  }
}

/**
 * Output from a process.
 */
export class ProcessOutput {
  private readonly delimiter = '\n'
  private readonly messages: ProcessMessage[] = []
  private _error = false

  /**
   * Whether the process has errored.
   */
  get error(): boolean {
    return this._error
  }

  /**
   * The stdout from the process.
   */
  get stdout(): string {
    return this.messages
      .filter(out => !out.error)
      .map(out => out.line)
      .join(this.delimiter)
  }

  /**
   * The stderr from the process.
   */
  get stderr(): string {
    return this.messages
      .filter(out => out.error)
      .map(out => out.line)
      .join(this.delimiter)
  }

  addStdout(message: ProcessMessage) {
    this.insertByTimestamp(message)
  }

  addStderr(message: ProcessMessage) {
    this._error = true
    this.insertByTimestamp(message)
  }

  private insertByTimestamp(message: ProcessMessage) {
    let i = this.messages.length - 1
    while (i >= 0 && this.messages[i].timestamp > message.timestamp) {
      i -= 1
    }
    this.messages.splice(i + 1, 0, message)
  }
}

/**
 * A process running in the environment.
 *
 */
export class Process {
  constructor(
    readonly processID: string,
    private readonly session: SessionConnection,
    private readonly triggerExit: () => void,
    readonly finished: Promise<ProcessOutput>,
    readonly output: ProcessOutput,
  ) {}

  /**
   * Kills the process.
   */
  async kill(): Promise<void> {
    try {
      await this.session.call(processService, 'kill', [this.processID])
    } finally {
      this.triggerExit()
      await this.finished
    }
  }

  /**
   * Sends data to the process stdin.
   *
   * @param data Data to send
   */
  async sendStdin(data: string): Promise<void> {
    await this.session.call(processService, 'stdin', [this.processID, data])
  }
}

export interface ProcessManager {
  readonly start: (opts: {
    cmd: string
    onStdout?: (out: ProcessMessage) => void
    onStderr?: (out: ProcessMessage) => void
    onExit?: () => void
    envVars?: EnvVars
    rootdir?: string
    processID?: string
  }) => Promise<Process>
}
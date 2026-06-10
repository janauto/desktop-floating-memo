/** 终端页：命令行方式查看/修改配置（主进程侧仍会做白名单校验与钳制） */
import { escapeHtml } from '../controls'
import { saveSettings, state } from '../state'

export function renderTerminal(container: HTMLElement): void {
  container.innerHTML = `
    <div class="terminal-wrapper">
      <div class="term-body" id="termBody">
        <div class="boot-sequence">
          <p>MEMO_OS v2.0.0 initializing...</p>
          <p>Loading database module... [OK]</p>
          <p>Mounting game logic... [OK]</p>
          <p>Type <span class="highlight">help</span> for available commands.</p>
        </div>
        <div id="termOutput"></div>
        <div class="term-input-line">
          <span class="prompt">admin@memo:~$</span>
          <input type="text" id="termInput" autocomplete="off" spellcheck="false">
        </div>
      </div>
    </div>
  `

  const input = document.getElementById('termInput') as HTMLInputElement
  const output = document.getElementById('termOutput') as HTMLElement
  const body = document.getElementById('termBody') as HTMLElement

  container.addEventListener('click', () => input.focus())

  const printLine = (html: string): void => {
    const p = document.createElement('div')
    p.className = 'term-line'
    p.innerHTML = html
    output.appendChild(p)
    body.scrollTop = body.scrollHeight
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = input.value.trim()
      input.value = ''
      printLine(`<span class="prompt">admin@memo:~$</span> ${escapeHtml(val)}`)
      if (val) processCommand(val, printLine, output)
    }
  })

  window.setTimeout(() => input.focus(), 50)
}

function parseArgs(cmdStr: string): string[] {
  const regex = /[^\s"]+|"([^"]*)"/g
  const args: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(cmdStr)) !== null) {
    args.push(match[1] !== undefined ? match[1] : match[0])
  }
  return args
}

function processCommand(cmdStr: string, printLine: (html: string) => void, output: HTMLElement): void {
  const args = parseArgs(cmdStr)
  if (args.length === 0) return
  const cmd = args[0].toLowerCase()
  const settings = state.settings as unknown as Record<string, unknown>

  switch (cmd) {
    case 'help':
      printLine(`AVAILABLE COMMANDS:
  <span class="cmd-name">help</span>      - Show this help message
  <span class="cmd-name">list</span>      - List all current configuration parameters
  <span class="cmd-name">get</span>       - Get a specific parameter (e.g., get xpNormal)
  <span class="cmd-name">set</span>       - Set parameter (e.g., set xpNormal 20)
  <span class="cmd-name">clear</span>     - Clear terminal screen
  <span class="cmd-name">exit</span>      - Close the terminal session`)
      break

    case 'clear':
      output.innerHTML = ''
      break

    case 'exit':
      void window.api.closeSettings()
      break

    case 'list': {
      let out = 'CURRENT SYSTEM PARAMETERS:<br>'
      for (const [k, v] of Object.entries(settings)) {
        out += `  <span class="param-key">${escapeHtml(k)}</span> = <span class="param-val">${escapeHtml(JSON.stringify(v))}</span><br>`
      }
      printLine(out)
      break
    }

    case 'get': {
      if (args.length < 2) {
        printLine('<span class="error">Error: Usage: get [key]</span>')
        return
      }
      const gkey = args[1]
      if (settings[gkey] !== undefined) {
        printLine(
          `  <span class="param-key">${escapeHtml(gkey)}</span> = <span class="param-val">${escapeHtml(JSON.stringify(settings[gkey]))}</span>`
        )
      } else {
        printLine(`<span class="error">Error: Key '${escapeHtml(gkey)}' not found.</span>`)
      }
      break
    }

    case 'set': {
      if (args.length < 3) {
        printLine('<span class="error">Error: Usage: set [key] [value]</span>')
        return
      }
      const key = args[1]
      const val = args.slice(2).join(' ')
      if (settings[key] === undefined) {
        printLine(`<span class="error">Error: Configuration key '${escapeHtml(key)}' not found.</span>`)
        return
      }

      const currentType = typeof settings[key]
      let parsedVal: unknown = val
      try {
        if (currentType === 'number') {
          parsedVal = Number(val)
          if (Number.isNaN(parsedVal)) throw new Error('Must be a number')
        } else if (currentType === 'boolean') {
          if (val === 'true') parsedVal = true
          else if (val === 'false') parsedVal = false
          else throw new Error('Must be true or false')
        } else if (currentType === 'object') {
          try {
            parsedVal = JSON.parse(val)
          } catch {
            parsedVal = val.split(',').map((s) => s.trim())
          }
        }
        ;(state.settings as unknown as Record<string, unknown>)[key] = parsedVal
        saveSettings()
        printLine(
          `<span class="success">Success: Parameter '${escapeHtml(key)}' updated to ${escapeHtml(JSON.stringify(parsedVal))}</span>`
        )
      } catch (e) {
        printLine(`<span class="error">Parse Error: ${escapeHtml(e instanceof Error ? e.message : String(e))}</span>`)
      }
      break
    }

    default:
      printLine(`<span class="error">Command not found: ${escapeHtml(cmd)}</span>`)
  }
}

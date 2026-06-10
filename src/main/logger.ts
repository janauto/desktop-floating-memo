/**
 * 统一日志：electron-log 写入 userData/logs，并捕获主进程未处理异常。
 */
import log from 'electron-log/main'

export function initLogger(): typeof log {
  log.initialize()
  log.transports.file.level = 'info'
  log.transports.file.maxSize = 5 * 1024 * 1024 // 5MB 滚动
  log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'warn'

  log.errorHandler.startCatching({
    showDialog: false,
    onError: ({ error }) => {
      log.error('[uncaught]', error)
    }
  })

  return log
}

export { log }

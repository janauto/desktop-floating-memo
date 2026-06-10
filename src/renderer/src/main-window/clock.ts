/** 标题栏实时时钟 */
export function startClock(el: HTMLElement): () => void {
  const update = (): void => {
    const now = new Date()
    const pad = (n: number) => n.toString().padStart(2, '0')
    el.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  }
  update()
  const interval = window.setInterval(update, 1000)
  return () => window.clearInterval(interval)
}

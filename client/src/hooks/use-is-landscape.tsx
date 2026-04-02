import * as React from "react"

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0
  )
}

export function useIsLandscape(): boolean {
  const [isLandscape, setIsLandscape] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(orientation: landscape)").matches && isMobileDevice()
  })

  React.useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape)")
    const onChange = (e: MediaQueryListEvent) => {
      setIsLandscape(e.matches && isMobileDevice())
    }
    mq.addEventListener("change", onChange)
    setIsLandscape(mq.matches && isMobileDevice())
    return () => mq.removeEventListener("change", onChange)
  }, [])

  return isLandscape
}

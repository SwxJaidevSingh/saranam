/**
 * Utility function to download Recharts SVG element as a standalone SVG file.
 * Handles dimensions, styles, CSS variables, and theme-appropriate background colors.
 */
export function exportChartAsSvg(containerId, filename = 'chart.svg') {
  const container = document.getElementById(containerId)
  if (!container) {
    console.error(`Container with ID "${containerId}" not found.`)
    return
  }

  const svgElement = container.querySelector('.recharts-surface') || container.querySelector('svg')
  if (!svgElement) {
    console.error(`No SVG element found inside container "${containerId}".`)
    return
  }

  // Clone the SVG element so we do not modify the on-screen node
  const svgClone = svgElement.cloneNode(true)

  // Get current dimensions
  const rect = svgElement.getBoundingClientRect()
  const width = rect.width || svgElement.clientWidth || 800
  const height = rect.height || svgElement.clientHeight || 450

  // Set explicit width, height and viewBox for proper standalone rendering
  svgClone.setAttribute('width', width)
  svgClone.setAttribute('height', height)
  if (!svgClone.getAttribute('viewBox')) {
    svgClone.setAttribute('viewBox', `0 0 ${width} ${height}`)
  }
  svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  // Retrieve current active colors in the portal for high-fidelity export styling
  const rootStyles = getComputedStyle(document.documentElement)
  const isDark = document.documentElement.classList.contains('dark') || 
                 rootStyles.getPropertyValue('color-scheme') === 'dark'

  const bg = isDark ? '#09090b' : '#ffffff'
  const text = isDark ? '#f4f4f5' : '#09090b'
  const mutedText = isDark ? '#a1a1aa' : '#71717a'
  const gridStroke = isDark ? '#27272a' : '#e4e4e7'
  const accentColor = rootStyles.getPropertyValue('--accent-color').trim() || '#0284c7'

  // Inject a style sheet that preserves fonts and layout colors when viewed outside the browser app
  const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  styleEl.textContent = `
    svg {
      background-color: ${bg};
      color: ${text};
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    text {
      fill: ${text};
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    .recharts-cartesian-axis-tick-value {
      fill: ${mutedText};
    }
    .recharts-cartesian-grid-horizontal line,
    .recharts-cartesian-grid-vertical line {
      stroke: ${gridStroke};
    }
    :root {
      --accent-color: ${accentColor};
    }
  `
  svgClone.insertBefore(styleEl, svgClone.firstChild)

  // Convert SVG clone to XML string and trigger download
  const svgString = new XMLSerializer().serializeToString(svgClone)
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const blobURL = URL.createObjectURL(svgBlob)

  const link = document.createElement('a')
  link.href = blobURL
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(blobURL)
}

import { toPng } from 'html-to-image';

/**
 * Utility function to download a chart or visualization card as a high-fidelity PNG image.
 * This captures the entire container (including title, description, and charts) while
 * hiding the export/download button itself during capture.
 */
export function exportChartAsSvg(containerId, filename = 'chart.png') {
  const container = document.getElementById(containerId)
  if (!container) {
    console.error(`Container with ID "${containerId}" not found.`)
    return
  }

  // Retrieve current active colors in the portal for theme-appropriate background matching
  const rootStyles = getComputedStyle(document.documentElement)
  const isDark = document.documentElement.classList.contains('dark') || 
                 rootStyles.getPropertyValue('color-scheme') === 'dark'

  const bg = isDark ? '#09090b' : '#ffffff'

  // Ensure file extension is .png
  const pngFilename = filename.replace(/\.(svg|png|jpg|jpeg)$/i, '') + '.png'

  toPng(container, {
    backgroundColor: bg,
    filter: (node) => {
      // Exclude the download button from the exported image
      if (node.tagName === 'BUTTON') {
        const isDownloadBtn = 
          node.getAttribute('title')?.toLowerCase().includes('download') || 
          node.getAttribute('data-export-ignore') === 'true' ||
          // Check if button contains download classes or is in header action
          node.classList.contains('h-8') && node.classList.contains('w-8');
        if (isDownloadBtn) return false;
      }
      return true;
    },
    style: {
      borderRadius: '0',
    },
    cacheBust: true,
  })
    .then((dataUrl) => {
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = pngFilename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    })
    .catch((error) => {
      console.error('Error generating image from DOM element:', error)
    })
}

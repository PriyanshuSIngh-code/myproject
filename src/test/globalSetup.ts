let serverInstance: any

export async function setup() {
  process.env.DISABLE_CLOUD_AI_IN_TESTS = 'true'
  try {
    // Check if server is already running on port 3001
    const check = await fetch('http://localhost:3001/api/health').catch(() => null)
    if (check) {
      console.log('[Test Setup] Backend is already running on port 3001')
      return
    }

    // Dynamically import backend server
    // @ts-expect-error JS import in TS test
    const mod = await import('../../server/index.js')
    serverInstance = mod.server
    // Wait for server to bind
    await new Promise(resolve => setTimeout(resolve, 800))
    console.log('[Test Setup] Backend server successfully started on port 3001')
  } catch (err) {
    console.warn('[Test Setup] Could not auto-start backend server:', err)
  }
}

export async function teardown() {
  if (serverInstance && typeof serverInstance.close === 'function') {
    await new Promise(resolve => serverInstance.close(resolve))
    console.log('[Test Teardown] Backend server closed cleanly')
  }
}

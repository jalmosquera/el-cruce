import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repositoryDirectory = fileURLToPath(new URL('../..', import.meta.url))
const composeFile = 'compose.e2e.yaml'
const composeProject = 'elcruce-e2e'

function runCompose(arguments_) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['compose', '--project-name', composeProject, '-f', composeFile, ...arguments_], {
      cwd: repositoryDirectory,
      stdio: 'inherit',
    })
    child.on('error', (error) => reject(new Error(`No se pudo ejecutar Docker Compose para E2E: ${error.message}`)))
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Docker Compose para E2E finalizó con código ${code}.`))
    })
  })
}

export default async function globalSetup() {
  await runCompose(['up', '--build', '--detach', '--wait'])

  return async () => {
    await runCompose(['down', '--volumes', '--remove-orphans'])
  }
}

import { IndexerApiModule } from "./modules/api"

async function startup(): Promise<void> {
  console.log(`startup`)
  const API_LISTEN_PORT = 4568
  const api = new IndexerApiModule( API_LISTEN_PORT)
  await api.listen()
}

void startup()

process.on('unhandledRejection', (error: Error) => {
  console.log('unhandledRejection', error.message)
})

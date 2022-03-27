import { IndexerApiModule } from "./modules/api"
import { CoreService } from "./services"

async function startup(): Promise<void> {
  console.log(`startup`)
  const instance = new CoreService()
  await instance.start();
  const API_LISTEN_PORT = 4568
  const api = new IndexerApiModule(instance, API_LISTEN_PORT)
  await api.listen()
}

void startup()

process.on('unhandledRejection', (error: Error) => {
  console.log('unhandledRejection', error.message)
})

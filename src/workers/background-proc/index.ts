import { BackgroundCore } from "./core"
import 'dotenv/config'


void (async () => {
    const bg = new BackgroundCore()
    await bg.start()
})()
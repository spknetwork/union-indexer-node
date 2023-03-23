import { BackgroundCore } from "./core"


void (async () => {
    const bg = new BackgroundCore()
    await bg.start()
})()
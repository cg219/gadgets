import { run } from './run.ts';

self.addEventListener('message', async function (evt: MessageEvent) {
    const { input, output, abr, vbr, codec, passFile, threads } = evt.data;

    await run({ input, output, abr, vbr, codec, passFile, threads });

    self.postMessage(true);
    self.close();
})

import { run } from './run.ts';
import { ThreadData } from './types.ts';

self.addEventListener('message', async (evt: MessageEvent<ThreadData>) => {
    const { input, output, abr, vbr, codec, passFile, threads } = evt.data;

    await run({ input, output, abr, vbr, codec, passFile, threads });

    self.postMessage(true);
    self.close();
})

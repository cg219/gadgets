function parseProgress(progress: string, total: number, start: number) {
    const arr = progress.split(/\r?\n/);
    const micros = arr.find((l) => l.includes('out_time_ms'))?.split('=').at(1);

    return micros ? ((Number(Math.abs(micros)) / 1000000) + start) / total : 0;
}

function getProgress(stream: ReadableStream, total = 0, start = 0) {
    const decoder = new TextDecoder();

    async function* generate(s: ReadableStream) {
        for await( const chunk of s) yield chunk;
    }

    return {
        async *[Symbol.asyncIterator]() {
            for await(const s of generate(stream)) {
                yield parseProgress(decoder.decode(s), total, start);
            }
        }
    }
}

export {
    getProgress,
    parseProgress
}

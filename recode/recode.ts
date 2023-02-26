import { extname, resolve, parse as pathParse } from 'https://deno.land/std@0.178.0/path/mod.ts';
import { Command } from 'https://deno.land/x/cliffy@v0.25.7/mod.ts';
import { JSONList, RecodeOptions } from './types.ts';

const THREADS = 4;
const VIDEO_BITRATE = '1400k';
const AUDIO_BITRATE = '128k';
const CODEC = 'libx265';
// const AUDIO_CODEC = 'aac';
const acceptedTypes = ['.mp4', '.mov', '.mkv', '.mpeg', '.mpg'];

if (import.meta.main) {
    try {
        await new Command()
            .name('recode')
            .version('1.2.0')
            .description('Re-encode video to a lower bitrate (H.265)')
            .usage('[options]')
            .option('-f, --file <file:file>', 'File to encode', { collect: true })
            .option('-o, --output <output:file>', 'Filename to save encoded file', { collect: true })
            .option('-a, --abr [abr:string]', 'Audio Bitrate to encode to', { default: AUDIO_BITRATE })
            .option('-v, --vbr [vbr:string]', 'Video Bitrate to encode to', { default: VIDEO_BITRATE })
            .option('-d, --directory [directory:boolean]', 'Sets --file to a directory', { default: false, conflicts: ['output'] })
            .option('-l, --list [list:boolean]', 'Sets --file to a JSON file of file inputs', { default: false })
            .option('-m, --match [match:string]', 'Only encode files starting with this')
            .option('-q, --sequence [sequence:boolean]', 'Recode files sequentially', { default: false })
            .option('-t, --threads [threads:integer]', 'Number of threads to use to per video', { default: THREADS })
            .action(recode)
            .parse(Deno.args)
        } catch(e) {
            console.error(e);
            Deno.exit(1);
        }
}

function createWorker(input: string, output: string, options: RecodeOptions, totalFiles?: number) {
    const thread = new URL('thread.ts', import.meta.url).href;
    const worker = new Worker(thread, { type: 'module' });
    const passFile = `${pathParse(input).name}.log`;

    return new Promise((resolve) => {
        const threads = options.sequence ? options.threads : Math.ceil(options.threads / (totalFiles ?? options.file.length));
        worker.postMessage({ input, output, abr: options.abr, vbr: options.vbr, codec: CODEC, passFile, threads });
        worker.addEventListener('message', (_) => resolve(true));
    })
}

// deno-lint-ignore no-explicit-any
async function recode(options: any) {
    const isDirectory = options.directory;
    const isList = options.list;
    const queue = [];

    if (isDirectory) {
        console.log('Running on Folder')
        if (options.file.length > 1) throw new Error('If file is a directory, only one file path is required');

        for await (const file of Deno.readDir(resolve(Deno.cwd(), options.file[0]))) {
            if (file.isFile && acceptedTypes.includes(extname(file.name)) && (options.match ? file.name.startsWith(options.match) : true)) {
                const { name, ext } = pathParse(file.name);
                const input = resolve(Deno.cwd(), options.file[0], file.name);
                const output = resolve(Deno.cwd(), options.file[0], `${name}-recode${ext}`);

                console.log(typeof input);
                console.log(`processing ${name}${ext}`);
                if (!options.sequence) {
                    queue.push(createWorker(input, output, options));
                } else {
                    await createWorker(input, output, options);
                }
            }
        }
    } else if (isList) {
        if (options.file.length > 1) throw new Error('If file is a JSON list, only one file path is required');

        const res = await fetch(`file://${resolve(Deno.cwd(), options.file[0])}`);
        const json: JSONList = await res.json();
        const iterable = {
            async *[Symbol.asyncIterator]() {
                for (const val of Object.entries(json)) {
                    yield val
                }
            }
        }

        for await (const [file, fileOutput] of iterable) {
            const { name, ext } = pathParse(file);
            const input = resolve(Deno.cwd(), file);
            const output = resolve(Deno.cwd(), fileOutput);

            console.log(`processing ${name}${ext}`);

            if (!options.sequence) {
                queue.push(createWorker(input, output, options, Object.values(json).length));
            } else {
                await createWorker(input, output, options);
            }
        }
    } else {
        let i = 0;

        if (options.file.length != options.output.length) {
            throw new Error('File inputs and outputs are not even. Make sure there is an output for every input file');
        }

        for await (const file of options.file) {
            const { name, ext } = pathParse(file);
            const input = resolve(Deno.cwd(), file);
            const output = resolve(Deno.cwd(), options.output[i]);
            console.log(`processing ${name}${ext}`);
            if (!options.sequence) {
                queue.push(createWorker(input, output, options));
            } else {
                await createWorker(input, output, options);
            }
            i++;
        }
    }

    if (!options.sequence) await Promise.all(queue);
}

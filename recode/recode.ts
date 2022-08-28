import { parse } from 'https://deno.land/std@0.153.0/flags/mod.ts';
import { extname, join, isAbsolute, resolve, parse as pathParse } from 'https://deno.land/std@0.153.0/path/mod.ts';

const THREADS = '4';
const VIDEO_BITRATE = '1400k';
const AUDIO_BITRATE = '128k';

const args = parse(Deno.args, {
    collect: ['file', 'output'],
    string: ['abr', 'vbr', 'match', 'directory'],
    boolean: ['seq'],
    default: {
        'q': false,
        't': THREADS,
        'a': AUDIO_BITRATE,
        'v': VIDEO_BITRATE
    },
    alias: {
        'f': 'file',
        'o': 'output',
        'a': 'abr',
        'd': 'directory',
        'h': 'help',
        'm': 'match',
        'v': 'vbr',
        't': 'threads',
        'q': 'seq'
    }
});
const CODEC = 'libx265';
const AUDIO_CODEC = 'aac';
const acceptedTypes = ['.mp4', '.mov', '.mkv', '.mpeg', '.mpg'];

function help() {
    console.log(`
        recode Help Menu
        ----------------

        Re-encode video to a lower bitrate (H.265)

        Required:

        -f --file: File to encode (Only required if --directory isn't used)
        -o --output: Filename to save encoded file (Only required if --directory isn't used)

        Options:

        -a --abr: Audio Bitrate to encode to. Defaults to "${AUDIO_BITRATE}"
        -d --directory: Directory of files to encode
        -h --help: Print help menu
        -m --match: Only encode files starting with this. (Only used if --directory is used)
        -t --threads: Number of threads to use to per video. Defaults to "${THREADS}"
        -v --vbr: Video Bitrate to encode to. Defaults to "${VIDEO_BITRATE}"
        -q --seq: Recode files sequentially. Defaults to false
    `)
}

function createWorker(input: string, output: string, totalFiles?: number) {
    const thread = new URL('thread.ts', import.meta.url).href;
    const worker = new Worker(thread, { type: 'module' });
    const passFile = `${pathParse(input).name}.log`;

    return new Promise((resolve) => {
        let threads = args.seq ? Math.ceil(args.threads / totalFiles) : args.threads
        worker.postMessage({ input, output, abr: args.abr, vbr: args.vbr, codec: CODEC, passFile, threads });
        worker.addEventListener('message', (_) => resolve(true));
    })
}

async function main() {
    const queue = [];

    if (args.help || Object.values(args).length <= 1) return help();

    if (!args.file && !args.directory) {
        console.log('Missing file or directory to re-encode');
        return;
    }

    if (!args.output && !args.directory) {
        console.log('Missing output file');
        return;
    }

    if (args.file && args.directory) {
        console.log(`--file and --directory are both set. Choose only one.`);
        return;
    }

    const isDirectory = args.directory ? true : false;
    let i = 0;

    if (isDirectory) {
        console.log('Running on Folder')
        for await (const file of Deno.readDir(resolve(Deno.cwd(), args.directory))) {
            if (file.isFile && acceptedTypes.includes(extname(file.name)) && (args.match ? file.name.startsWith(args.match) : true)) {
                const { name, ext } = pathParse(file.name);
                const input = resolve(Deno.cwd(), args.directory, file.name);
                const output = resolve(Deno.cwd(), args.directory, `${name}-recode${ext}`);

                console.log(typeof input);
                console.log(`processing ${name}${ext}`);
                if (!args.seq) {
                    queue.push(createWorker(input, output));
                } else {
                    await createWorker(input, output, args.file.length);
                }
            }
        }
    } else {
        for await (const file of args.file) {
            const { name, ext } = pathParse(file);
            const input = resolve(Deno.cwd(), file);
            const output = resolve(Deno.cwd(), args.output[i]);
            console.log(`processing ${name}${ext}`);
            if (!args.seq) {
                queue.push(createWorker(input, output));
            } else {
                await createWorker(input, output, args.file.length);
            }
            i++;
        }
    }

    if (!args.seq) await Promise.all(queue);

    console.log('Finished Encoding');
}

await main();

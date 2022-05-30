import { parse } from 'https://deno.land/std@0.141.0/flags/mod.ts';
import { extname, join, isAbsolute, resolve, parse as pathParse } from 'https://deno.land/std@0.141.0/path/mod.ts';

const args = parse(Deno.args, {
    collect: ['file'],
    string: ['abr', 'vbr', 'match', 'folder'],
    alias: {
        'f': 'file',
        'o': 'output',
        'a': 'abr',
        'd': 'folder',
        'h': 'help',
        'm': 'match',
        'v': 'vbr',
        't': 'threads'
    }
});
const VIDEO_BITRATE = '1400k';
const AUDIO_BITRATE = '128k';
const CODEC = 'libx265';
const AUDIO_CODEC = 'aac';
const THREADS = '4';
const acceptedTypes = ['.mp4', '.mov', '.mkv', '.mpeg', '.mpg'];

function help() {
    console.log(`
        recode Help Menu
        ----------------

        Re-encode video to a lower bitrate (H.265)

        Required:

        -f --file: File to encode (Only required if --folder isn't used)
        -o --output: Filename to save encoded file (Only required if --folder isn't used)

        Options:

        -a --abr: Audio Bitrate to encode to. Defaults to "${AUDIO_BITRATE}"
        -d --folder: Folder of files to encode
        -h --help: Print help menu
        -m --match: Only encode files starting with this. (Only used if --folder is used)
        -t --threads: Number of threads to use to per video. Defaults to "${THREADS}"
        -v --vbr: Video Bitrate to encode to. Defaults to "${VIDEO_BITRATE}"
    `)
}

async function createWorker(input: string, output: string) {
    const thread = new URL('thread.ts', import.meta.url).href;
    console.log(thread);
    const worker = new Worker(thread, { type: 'module' });
    const passFile = `${pathParse(input).name}.log`;

    return new Promise((resolve) => {
        worker.postMessage({ input, output, abr: args.abr || AUDIO_BITRATE, vbr: args.vbr || VIDEO_BITRATE, codec: CODEC, passFile, threads: args.threads || THREADS });
        worker.addEventListener('message', (evt) => {
            resolve(true);
        })
    })
}

async function main() {
    const queue = [];

    if (args.help || Object.values(args).length <= 1) return help();

    if (!args.file && !args.folder) {
        console.log('Missing file or folder to re-encode');
        return;
    }

    if (!args.output && !args.folder) {
        console.log('Missing output file');
        return;
    }

    if (args.file && args.folder) {
        console.log(`--file and --folder are both set. Choose only one.`);
        return;
    }

    const isFolder = args.folder ? true : false;
    let i = 0;

    if (isFolder) {
        console.log('Running on Folder')
        for await (const file of Deno.readDir(resolve(Deno.cwd(), args.folder))) {
            if (file.isFile && acceptedTypes.includes(extname(file.name)) && (args.match ? file.name.startsWith(args.match) : true)) {
                const { name, ext } = pathParse(file.name);
                const input = resolve(Deno.cwd(), args.folder, file.name);
                const output = resolve(Deno.cwd(), args.folder, `${name}-recode${ext}`);

                console.log(typeof input);
                console.log(`processing ${name}${ext}`);
                queue.push(createWorker(input, output));
            }
        }
    } else {
        for await (const file of args.file) {
            const { name, ext } = pathParse(file);
            const input = resolve(Deno.cwd(), file);
            const output = resolve(Deno.cwd(), (args.output[i] || `${name}-recode${ext}`));
            console.log(`processing ${name}${ext}`);
            queue.push(createWorker(input, output));
            i++;
        }
    }

    await Promise.all(queue);

    console.log('Finished Encoding');
}

await main();

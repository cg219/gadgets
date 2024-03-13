import { extname, resolve, parse as pathParse } from '@std/path';
import { Command } from 'https://deno.land/x/cliffy@v0.25.7/mod.ts';
import { JSONList, RecodeOptions } from './types.ts';
import { $ } from '@david/dax';
import { run } from './run.ts';

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
            .option('-c, --cimode [ci:boolean]', 'Run in CI Mode', { default: false })
            .action(recode)
            .parse(Deno.args)
        } catch(e) {
            console.error(e);
            Deno.exit(1);
        }
}

function executeRun(input: string, output: string, options: RecodeOptions, totalFiles?: number) {
    const passFile = `${pathParse(input).name}.log`;
    const threads = options.sequence ? options.threads : Math.ceil(options.threads / (totalFiles ?? options.file.length));

    return run({ input, output, abr: options.abr, vbr: options.vbr, codec: CODEC, passFile, threads, ci: options.cimode });
}

async function walkDir(options: RecodeOptions) {
    const queue = [];

    for await (const file of Deno.readDir(resolve(Deno.cwd(), options.file[0]))) {
        if (file.isFile && acceptedTypes.includes(extname(file.name)) && (options.match ? file.name.startsWith(options.match) : true)) {
            const { name, ext } = pathParse(file.name);
            const input = resolve(Deno.cwd(), options.file[0], file.name);
            const output = resolve(Deno.cwd(), options.file[0], `${name}-recode${ext}`);

            $.logStep(`recoding ${input}`);

            if (!options.sequence) {
                queue.push(executeRun(input, output, options));
            } else {
                await executeRun(input, output, options);
            }
        }
    }
}

async function recode(options: any) {
    const isDirectory = options.directory;
    const isList = options.list;
    const cimode = options.cimode ?? false;
    const queue = [];

    if (isDirectory) {
        if (options.file.length > 1) throw new Error('If file is a directory, only one file path is required');
        $.logStep(`recoding from directory`);

        if (!cimode) {
            const progress = $.progress('');

            progress.prefix('overall processing');

            await progress.with(async () => {
                await walkDir(options);
            });
        } else {
            await walkDir(options);
        }

    } else if (isList) {
        if (options.file.length > 1) throw new Error('If file is a JSON list, only one file path is required');

        $.logStep(`recoding from list`);
        const res = await fetch(`file://${resolve(Deno.cwd(), options.file[0])}`);
        const json: JSONList = await res.json();
        const iterable = {
            async *[Symbol.asyncIterator]() {
                for (const val of Object.entries(json)) {
                    yield val;
                }
            }
        }

        if (!cimode) {
            const progress = $.progress('')

            progress.prefix('recoding progress');

            if (options.sequence) {
                progress.length(Object.keys(json).length);
                progress.message(`${Object.keys(json).length} files`);
            }

            await progress.with(async () => {
                for await (const [file, fileOutput] of iterable) {
                    const input = resolve(Deno.cwd(), file);
                    const output = resolve(Deno.cwd(), fileOutput);

                    $.logStep(`recoding ${input}`);

                    if (!options.sequence) {
                        queue.push(executeRun(input, output, options, Object.values(json).length));
                        progress.finish();
                    } else {
                        await executeRun(input, output, options);
                        progress.increment();
                    }
                }
            });
        } else {
            for await (const [file, fileOutput] of iterable) {
                const input = resolve(Deno.cwd(), file);
                const output = resolve(Deno.cwd(), fileOutput);

                $.logStep(`recoding ${input}`);

                if (!options.sequence) {
                    queue.push(executeRun(input, output, options, Object.values(json).length));
                } else {
                    await executeRun(input, output, options);
                }
            }
        }
    } else {
        if (options.file.length != options.output.length) throw new Error('File inputs and outputs are not even. Make sure there is an output for every input file');

        let i = 0;

        for await (const file of options.file) {
            const input = resolve(Deno.cwd(), file);
            const output = resolve(Deno.cwd(), options.output[i]);

            $.logStep(`recoding ${input}`);

            if (!options.sequence) {
                queue.push(executeRun(input, output, options));
            } else {
                await executeRun(input, output, options);
            }

            i++;
        }
    }

    if (!options.sequence) await Promise.all(queue);
}

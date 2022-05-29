import { parse } from 'https://deno.land/std@0.140.0/flags/mod.ts';
import { extname, join, isAbsolute, resolve, parse as pathParse } from 'https://deno.land/std@0.140.0/path/mod.ts';

const args = parse(Deno.args);
const VIDEO_BITRATE = '1400k';
const AUDIO_BITRATE = '128k';
const CODEC = 'libx265';
const AUDIO_CODEC = 'aac';
const acceptedTypes = ['.mp4', '.mov', '.mk4', '.mpeg', '.mpg'];

async function main() {
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

    if (args.files) {
        const amount = Array.isArray(args.file) ? args.file.length : 1;
        let i = 0;

        if (amount == 1 && args.file) {
            await run(args.file, args.output);
            console.log('Finished Encoding');
            return;
        }

        const isFolder = args.folder ? true : false;

        if (isFolder) {
            for await (const file of Deno.readDir(args.folder)) {
                if (file.isFile && acceptedTypes.includes(extname(file.name)) && (args.match ? file.name.startsWith(args.match) : true)) {
                    const { name, ext } = pathParse(file.name);
                    await run(resolve(Deno.cwd(), args.folder, file.name), resolve(Deno.cwd(), args.folder, `${name}-recode${ext}`));
                }
            }
        } else {
            for await (const file of args.file) {
                const { name, ext } = pathParse(file);
                await run(resolve(Deno.cwd(), file), resolve(Deno.cwd(), (args.output[i] || `${name}-recode${ext}`)));
                i++;
            }
        }
    } else {
        await run(args.file, args.output);
    }

    try {
        await Deno.remove(resolve(Deno.cwd(), 'x265_2pass.log'))
        await Deno.remove(resolve(Deno.cwd(), 'x265_2pass.log.cutree'))
    } catch (e) {}

    console.log('Finished Encoding');
}

function help() {
    console.log(`
        recode Help Menu
        ----------------

        Re-encode video to a lower bitrate (H.265)

        Required:

        --file: File to encode (Only required if --folder isn't used)
        --output: Filename to save encoded file (Only required if --folder isn't used)

        Options:

        --abr: Audio Bitrate to encode to. Defaults to "${AUDIO_BITRATE}"
        --folder: Folder of files to encode
        --files: Add if encoding multiple files
        --help: Print help menu
        --match: Only encode files starting with this. (Only used if --folder is used)
        --vbr: Video Bitrate to encode to. Defaults to "${VIDEO_BITRATE}"
    `)
}

async function run(input: string, output: string) {
    const firstPass = [];
    const secondPass = [];

    firstPass.push('ffmpeg');
    firstPass.push('-y');
    firstPass.push('-i');
    firstPass.push(input);
    firstPass.push('-c:v');
    firstPass.push(CODEC);
    firstPass.push('-b:v');
    firstPass.push(args.vbr || VIDEO_BITRATE);
    firstPass.push('-x265-params');
    firstPass.push('pass=1');
    firstPass.push('-an');
    firstPass.push('-f');
    firstPass.push('null');
    firstPass.push('/dev/null/');

    secondPass.push('ffmpeg');
    secondPass.push('-i');
    secondPass.push(input);
    secondPass.push('-c:v');
    secondPass.push(CODEC);
    secondPass.push('-b:v');
    secondPass.push(args.vbr || VIDEO_BITRATE);
    secondPass.push('-x265-params');
    secondPass.push('pass=2');
    secondPass.push('-c:a');
    secondPass.push('aac');
    secondPass.push('-b:a');
    secondPass.push(args.abr || AUDIO_BITRATE);
    secondPass.push(output);

    const fpid = Deno.run({ cmd: firstPass });
    const fpstatus = await fpid.status();

    if (!fpstatus.success) {
        console.log('Error during First Pass');
        return;
    }

    const spid = Deno.run({ cmd: secondPass });
    await spid.status();
}

await main();

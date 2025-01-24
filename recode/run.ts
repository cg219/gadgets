import { $ } from '@david/dax';
import { getProgress } from './progress.ts';
import { ensureDir } from "@std/fs/ensure-dir";
import { dirname } from "@std/path/dirname";

interface RunnerOptions {
    input: string
    output: string
    abr: string
    vbr: string
    codec: string
    passFile: string
    threads: number,
    ci: boolean
}

async function run({ input, output, abr, vbr, codec, passFile, threads, ci }: RunnerOptions) {
    const firstPass:string[] = [];
    const secondPass:string[] = [];

    firstPass.push('-y');
    firstPass.push('-i');
    firstPass.push(input);
    firstPass.push('-c:v');
    firstPass.push(codec);
    firstPass.push('-b:v');
    firstPass.push(vbr);
    firstPass.push('-x265-params');
    firstPass.push('pass=1');
    firstPass.push('-x265-params');
    firstPass.push(`stats=${passFile}`);
    firstPass.push('-threads');
    firstPass.push(threads.toString());
    firstPass.push('-progress');
    firstPass.push('pipe:1');
    firstPass.push('-an');
    firstPass.push('-f');
    firstPass.push('null');
    firstPass.push('/dev/null/');

    secondPass.push('-y');
    secondPass.push('-i');
    secondPass.push(input);
    secondPass.push('-map');
    secondPass.push('0');
    secondPass.push('-c:v');
    secondPass.push(codec);
    secondPass.push('-b:v');
    secondPass.push(vbr);
    secondPass.push('-x265-params');
    secondPass.push('pass=2');
    secondPass.push('-x265-params');
    secondPass.push(`stats=${passFile}`);
    secondPass.push('-c:a');
    secondPass.push('aac');
    secondPass.push('-b:a');
    secondPass.push(abr);
    secondPass.push('-c:s');
    secondPass.push('copy');
    secondPass.push('-threads');
    secondPass.push(threads.toString());
    secondPass.push('-progress');
    secondPass.push('pipe:1');
    secondPass.push(output);

    const durcmd = new Deno.Command("ffprobe", {
        stdout: "piped",
        stderr: "piped",
        args: ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", input]
    });
    const duration = await durcmd.output()
    const passes = [firstPass, secondPass];
    const passMap = new Map();

    passMap.set(firstPass, 'first pass');
    passMap.set(secondPass, 'second pass');

    await ensureDir(dirname(output))

    if (!ci) {
        const progress = $.progress('', { length: 100 });

        progress.prefix(`processing`);
        progress.message(input);

        await progress.with(async () => {
            for (const pass of passes) {
                const cmd = new Deno.Command("ffmpeg", {
                    stdout: "piped",
                    stderr: "piped",
                    args: pass
                });
                const passRun = cmd.spawn()

                for await (const current of getProgress(passRun.stdout, Number(duration))) {
                    if (passMap.get(pass) == 'first pass') {
                        progress.position(Math.round(current * 100 * .5));
                    } else {
                        progress.position(Math.round(50 + (current * 100 * .5)));
                    }
                }

                await passRun;
            }
        })
    } else {
        for (const pass of passes) {
            const cmd = new Deno.Command("ffmpeg", {
                stdout: "piped",
                stderr: "piped",
                args: pass
            });
            const passRun = cmd.spawn()

            for await (const current of getProgress(passRun.stdout, Number(duration))) {
                if (passMap.get(pass) == 'first pass') {
                    console.log(Math.round(current * 100 * .5))
                } else {
                    console.log(Math.round(50 + (current * 100 * .5)));
                }
            }

            await passRun;
        }
    }
}

export { run };

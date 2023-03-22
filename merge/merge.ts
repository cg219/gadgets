import { extname, join, resolve, parse as pathParse } from 'https://deno.land/std@0.180.0/path/mod.ts';
import { Command } from 'https://deno.land/x/cliffy@v0.25.7/mod.ts';
import { $ } from 'https://deno.land/x/dax@0.30.1/mod.ts';

if (import.meta.main) {
    try {
        new Command()
            .name('merge')
            .version('2.0.0')
            .description('Merge subtitles and video into a .mkv')
            .usage('options')
            .option('-f, --folder <folder:file>', 'Folder containing files to merge')
            .option('-s, --subtitles <subFolder:file>', 'Name of the folder containing subtitle files')
            .option('-d, --flattened [subIsSubfolder:boolean]', 'Sets if sub files are directly in the --subtitles folder or if its in a subfolder', { default: false })
            .option('-n, --name <name:string>', 'Name of outputting file. Season is concatenated if --season is specified. Exclude file type in name.')
            .option('-e, --season [season:string]', 'Season of show. Will append to the end of the output file name')
            .action(merge)
            .parse(Deno.args)
    } catch (_) {
        Deno.exit(1);
    }
}

async function merge(options: any) {
    const files = [];
    const subMap = new Map();
    const mainDir = join(Deno.cwd(), options.folder);

    for await (const path of Deno.readDir(mainDir)) {
        if (extname(path.name) == '.mp4'|| extname(path.name) == '.mkv') {
            files.push(path.name);
            const subFolder = options.flattened ? join(mainDir, options.subtitles) : join(mainDir, options.subtitles, path.name.slice(0, -4));

            subMap.set(path.name.slice(0, -4), subFolder);
        }
    }

    files.sort();

    let pathIndex = 1;

    for await (const path of files) {
        const subs = [];
        const commandArray = ['ffmpeg'];
        const mapArray = [];
        const metadataArray = [];

        commandArray.push('-i');
        commandArray.push(`${join(mainDir, path)}`);

        for await (const subFile of Deno.readDir(subMap.get(path.slice(0, -4)))) {
            if (subFile.name != '.DS_Store') {
                subs.push(subFile.name);
            }
        }

        subs.sort((a, b) => {
            const newA = a.slice(0, a.indexOf('_'));
            const newB = b.slice(0, b.indexOf('_'));

            if (Number(newA) < Number(newB)) return -1;
            if (Number(newA) > Number(newB)) return 1;

            return 0;
        });

        let subIndex = 0;

        for (const sub of subs) {
            const subName = sub.slice(sub.indexOf('_') + 1).slice(0, -4);
            const subPath = options.flattened ? join(mainDir, options.subtitles, sub) : join(mainDir, options.subtitles, path.slice(0, -4), sub);

            commandArray.push('-i');
            commandArray.push(`${subPath}`);
            mapArray.push('-map');
            mapArray.push(`${subIndex}`);
            metadataArray.push(`-metadata:s:s:${subIndex}`);
            metadataArray.push(`handler_name=${subName}`);
            metadataArray.push(`-metadata:s:s:${subIndex}`);
            metadataArray.push(`title=${subName}`);
            subIndex++;
        }

        let cmd;
        if (options.season) {
            cmd = [...commandArray, ...mapArray, '-metadata', `title="${options.name} - s${options.season.toString().padStart(2, '0')}e${pathIndex.toString().padStart(3, '0')}.mkv"`, '-c', 'copy', ...metadataArray, `${options.name} - s${options.season.toString().padStart(2, '0')}e${pathIndex.toString().padStart(3, '0')}.mkv`]
        } else {
            cmd = [...commandArray, ...mapArray, '-metadata', `title="${options.name}.mkv"`, '-c', 'copy', ...metadataArray, `${options.name}.mkv`]
        }

        const pid = Deno.run({ cmd });
        await pid.status();
        pathIndex++;
    }
}

// deno run -A merge.ts --folder Love.Death.and.Robots.S01.1080p.WEBRip.x265-RARBG/ --subtitles Subs --name "Love Death and Robots" --season 1

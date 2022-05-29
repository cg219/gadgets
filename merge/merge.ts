import { parse } from 'https://deno.land/std@0.140.0/flags/mod.ts';
import { extname, join } from 'https://deno.land/std@0.140.0/path/mod.ts';

const args = parse(Deno.args);
const files = [];
const subMap = new Map();
const mainDir = join(Deno.cwd(), args.folder);

for await (const path of Deno.readDir(mainDir)) {
    if (extname(path.name) == '.mp4') {
        files.push(path.name);

        subMap.set(path.name.slice(0, -4), join(mainDir, args.subs, path.name.slice(0, -4)));
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
        subs.push(subFile.name);
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
        const subPath = join(mainDir, args.subs, path.slice(0, -4), sub);

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
    if (args.season) {
        cmd = [...commandArray, ...mapArray, '-metadata', `title="${args.name} - s${args.season.toString().padStart(2, '0')}e${pathIndex.toString().padStart(3, '0')}.mkv"`, '-c', 'copy', ...metadataArray, `${args.name} - s${args.season.toString().padStart(2, '0')}e${pathIndex.toString().padStart(3, '0')}.mkv`]
    } else {
        cmd = [...commandArray, ...mapArray, '-metadata', `title="${args.name}.mkv"`, '-c', 'copy', ...metadataArray, `${args.name}.mkv`]
    }

    const pid = Deno.run({ cmd });
    await pid.status();
    pathIndex++;
}

// deno run -A merge.ts --folder Love.Death.and.Robots.S01.1080p.WEBRip.x265-RARBG/ --subs Subs --name "Love Death and Robots" --season 1

import { parse } from 'https://deno.land/std@0.141.0/flags/mod.ts';
import { extname, join, isAbsolute, resolve, parse as pathParse } from 'https://deno.land/std@0.141.0/path/mod.ts';

const args = parse(Deno.args, {
    string: ['mode', 'name', 'directory', 'sort'],
    boolean: ['help'],
    default: {
        'm': 'count',
        'h': false,
        'd': null,
        's': 'asc'
    },
    alias: {
        'h': 'help',
        'd': 'directory',
        'n': 'name',
        'm': 'mode',
        's': 'sort'
    }
});
const modes = ['count'];
const sorts = ['asc', 'desc'];
const ERROR_STYLE = 'color: red';

interface RenameOptions {
    mode: string
    directory: string
    name: string
    sort: string
    pattern?: string
}

function help() {
    console.log(`
        rename Help Menu
        -----------------

        Rename a directory of files

        Required:

        -d --directory: Directory of files to rename
        -n --name: Name of renamed file

        Optional:

        -h --help: Print help menu
        -p --pattern: Matches files containing this string
        -m --mode: Rename mode
            count: Each file will increment in sort direction (Default)
        -s --sort: Sort direction
            asc: Ascending order (Default)
            desc: Descending order
        -S --custom-sort: List of indexes to correspond to a specific order

    `)
}

async function main() {
    if (args.h || Object.values(args).length <= 1) return help();
    if (!args.d) {
        console.log('%cNeed to provide a directory. --directory', ERROR_STYLE);
        Deno.exit(1);
    }

    if (!modes.includes(args.m.toLowerCase())) {
        console.log(`%cInvalid --mode ${args.m}. Check --help for valid modes.`, ERROR_STYLE);
        Deno.exit(1);
    }

    if (!args.n) {
        console.log(`%cProvide a name. --name`, ERROR_STYLE);
        Deno.exit(1);
    }

    if (!sorts.includes(args.s.toLowerCase())) {
        console.log(`%cInvalid --sort ${args.m}. Check --help for valid sorts.`, ERROR_STYLE);
        Deno.exit(1);
    }

    await rename({ directory: args.d, name: args.n, mode: args.m, sort: args.s, pattern: args.p });
}

function sortFunction(sort: string, a: string, b: string) {
    if (a.toUpperCase() < b.toUpperCase()) return sort == 'asc' ? -1 : 1;
    if (a.toUpperCase() > b.toUpperCase()) return sort == 'asc' ? 1 : -1;
    return 0;
}

async function rename(options: RenameOptions) {
    const { mode, directory, name, sort, pattern } = options;
    const files = [];
    let count = 0;

    for await (const file of Deno.readDir(resolve(Deno.cwd(), directory))) {
        if (file.isFile && pattern ? file.name.includes(pattern) : true) files.push(file.name);
    }

    files.sort((a, b) => sortFunction(sort, a, b));

    for await (const filename of files) {
        const original = resolve(Deno.cwd(), directory, filename);
        const ext = extname(original);
        const renamed = resolve(Deno.cwd(), directory, `${name}${count}${ext}`);

        await Deno.rename(original, renamed);
        count++;
    }
}

await main();

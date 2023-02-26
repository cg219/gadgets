export type ThreadData = {
    input: string;
    output: string;
    abr: string;
    vbr: string;
    codec: string;
    passFile: string;
    threads: string;
}

export type RecodeOptions = {
    file: string[];
    output: string[];
    vbr: string;
    abr: string;
    directory: boolean;
    list: boolean;
    match: boolean;
    threads: number;
    sequence: boolean
}

export type JSONList = {
    [key: string]: string;
}

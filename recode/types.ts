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
    match: string;
    threads: number;
    sequence: boolean;
    cimode: boolean;
}

export type JSONList = {
    [key: string]: string;
}

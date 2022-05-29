self.addEventListener('message', async function (evt: MessageEvent) {
    const { input, output, abr, vbr, codec, passFile } = evt.data;

    const firstPass = [];
    const secondPass = [];

    firstPass.push('ffmpeg');
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
    firstPass.push(1)
    firstPass.push('-an');
    firstPass.push('-f');
    firstPass.push('null');
    firstPass.push('/dev/null/');

    secondPass.push('ffmpeg');
    secondPass.push('-i');
    secondPass.push(input);
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
    secondPass.push('-threads');
    secondPass.push(1)
    secondPass.push(output);

    const fpid = Deno.run({ cmd: firstPass });
    const fpstatus = await fpid.status();

    if (!fpstatus.success) {
        console.log('Error during First Pass');
        return;
    }

    const spid = Deno.run({ cmd: secondPass });
    await spid.status();

    self.postMessage(true);
    self.close();
})

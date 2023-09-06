const fs = require("fs");

const cp = require("child_process");
const readline = require("readline");

const ytdl = require("ytdl-core");
const ffmpeg = require("ffmpeg-static");

function downloadAndMergeYouTubeVideo(link, outputFile, number) {
    const tracker = {
        start: Date.now(),
        audio: { downloaded: 0, total: Infinity },
        video: { downloaded: 0, total: Infinity },
        merged: { frame: 0, speed: "0x", fps: 0 },
    };

    const audio = ytdl(link, { quality: "highestaudio" }).on("progress", (_, downloaded, total) => {
        tracker.audio = { downloaded, total };
    });

    const video = ytdl(link, { filter: format => format.container === "mp4", quality: "highestvideo" }).on("progress", (_, downloaded, total) => {
        tracker.video = { downloaded, total };
    });

    let progressbarHandle = null;
    const progressbarInterval = 1000;

    const showProgress = () => {
        readline.cursorTo(process.stdout, 0);
        const toMB = i => (i / 1024 / 1024).toFixed(2);

        process.stdout.write(`Audio  | ${(tracker.audio.downloaded / tracker.audio.total * 100).toFixed(2)}% processed `);
        process.stdout.write(`(${toMB(tracker.audio.downloaded)}MB of ${toMB(tracker.audio.total)}MB).${" ".repeat(10)}\n`);

        process.stdout.write(`Video  | ${(tracker.video.downloaded / tracker.video.total * 100).toFixed(2)}% processed `);
        process.stdout.write(`(${toMB(tracker.video.downloaded)}MB of ${toMB(tracker.video.total)}MB).${" ".repeat(10)}\n`);

        process.stdout.write(`Merged | processing frame ${tracker.merged.frame} `);
        process.stdout.write(`(at ${tracker.merged.fps} fps => ${tracker.merged.speed}).${" ".repeat(10)}\n`);

        process.stdout.write(`running for: ${((Date.now() - tracker.start) / 1000 / 60).toFixed(2)} Minutes.`);
        readline.moveCursor(process.stdout, 0, -3);
    };

    const ffmpegProcess = cp.spawn(ffmpeg, [
        "-loglevel", "8", "-hide_banner",
        "-progress", "pipe:3",
        "-i", "pipe:4",
        "-i", "pipe:5",
        "-map", "0:a",
        "-map", "1:v",
        "-c:v", "copy",
        outputFile,
    ], {
        windowsHide: true,
        stdio: [
            "inherit", "inherit", "inherit",
            "pipe", "pipe", "pipe",
        ],
    });

    ffmpegProcess.on("close", () => {
        console.log("done");
        execute(number+1)
        process.stdout.write("\n\n\n\n");
        clearInterval(progressbarHandle);
    });

    ffmpegProcess.stdio[3].on("data", chunk => {
        if (!progressbarHandle) {
            progressbarHandle = setInterval(showProgress, progressbarInterval);
        }

        const lines = chunk.toString().trim().split("\n");
        const args = {};

        for (const l of lines) {
            const [key, value] = l.split("=");
            args[key.trim()] = value.trim();
        }

        tracker.merged = args;
    });

    audio.pipe(ffmpegProcess.stdio[4]);
    video.pipe(ffmpegProcess.stdio[5]);
}

const goals = fs.readFileSync("goals.csv").toString().split("\n").reverse();
const arr = fs.readdirSync("./out/");

console.log(arr)

async function execute(number) {
    if (number >= goals.length) {
        return
    }

    const values = goals[number].split(",");
    const link = values[13];

    let name = link.split("?v=")[1];

    if (name === undefined) {
        name = link.split(".be/")[1];
    } else {
        name = name.split("&")[0]
    }

    if (name === undefined || arr.includes(name+ ".mp4") || name === "jgPSLvfDAQo") {
        execute(number+1);
        return;
    }

	name = name + ".mp4";
    arr.push(name);

    try {
        await downloadAndMergeYouTubeVideo(link, "./out/" + name, number);
    } catch (e) {
        console.log(e);
        execute(number+1);
    }
}

execute(0);

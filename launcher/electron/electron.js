const electron = require("electron");
require("dotenv").config();
const { download } = require("electron-dl");
const { join } = require("path");
const extract = require("extract-zip");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { format } = require("url");
const { platform } = require("os");

const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
let mainWindow;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 300,
    height: 300,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), // use a preload script
      // nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // and load the index.html of the app.
  const startUrl =
    process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : format({
          pathname: path.join(__dirname, "/../build/index.html"),
          protocol: "file:",
          slashes: true,
        });

  mainWindow.loadURL(startUrl);

  // Emitted when the window is closed.
  mainWindow.on("closed", () => (mainWindow = null));
};
app.on("ready", createWindow);
app.on("window-all-closed", () => process.platform !== "darwin" && app.quit());
app.on("activate", () => mainWindow === null && createWindow());

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

electron.ipcMain.on("resize", (e, args) =>
  mainWindow.setSize(args.width, args.height)
);

electron.ipcMain.on("exit", () => app.quit());

const error = (e) => {
  if (mainWindow) {
    mainWindow.webContents.send("log", e);
    mainWindow.webContents.send(
      "error",
      `There was an error trying to execute that version (Check the log for more info).`
    );
  }
};
const progress = (stage, extra) =>
  mainWindow.webContents.send("progress", { stage, ...extra });

const execCallback = (e, d) => e && e.errno !== -2 && error("LaunchError");

electron.ipcMain.on("launchGame", async (event, { data, tag }) => {
  const repo =
    process.env.CUSTOM_REPO ||
    "f1shy-dev/cm-mm-launcher-testing" ||
    "Sequitur-Studios/Cell-Machine-Mystic-Mod";

  const isMacOS = platform() === "darwin";
  const userDir = electron.app.getPath("userData");
  const dlPath = join(userDir, "/dlTemp/");
  const extractPath = join(userDir, `/versions/${tag}/`);
  const assetUrl = `https://github.com/${repo}/releases/download/${tag}/${
    data.launcherData.fileNames[platform()]
  }`;

  const runPath = join(
    extractPath,
    isMacOS ? "StandaloneOSX.app" : "bundle.exe"
  );

  try {
    if (!fs.existsSync(dlPath)) fs.mkdirSync(dlPath);

    if (!fs.existsSync(runPath)) {
      await download(mainWindow, assetUrl, {
        directory: dlPath,
        filename: "pack.zip",
        onProgress: (p) => progress("downloading", p),
      });

      progress("extracting", { percent: 1 });

      await extract(join(dlPath, "pack.zip"), { dir: extractPath });
    }

    progress("launching", { percent: 1 });

    if (isMacOS) {
      exec(`chmod -R 755 "${runPath}"`, execCallback);
      exec(`open -a "${runPath}";exit`, execCallback);
    } else {
      exec(`${runPath}`, console.log);
    }

    progress("cleaning", { percent: 1 });

    fs.rmdir(dlPath, error);

    app.quit();
  } catch (err) {
    error(err);
  }
});

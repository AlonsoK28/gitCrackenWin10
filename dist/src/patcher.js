"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const os = require("os");
const path = require("path");
const asar = require("asar");
const diff = require("diff");
const fs = require("fs-extra");
const natsort_1 = require("natsort");
const semver = require("semver");
const global_1 = require("../global");
const platform_1 = require("./platform");
class Patcher {
    static findAsarUnix(...files) {
        return files.find((file) => fs.existsSync(file));
    }
    static findAsarLinux() {
        return Patcher.findAsarUnix("/opt/gitkraken/resources/app.asar", "/usr/share/gitkraken/resources/app.asar");
    }
    static findAsarWindows() {
        const gitkrakenLocal = path.join(os.homedir(), "AppData/Local/gitkraken");
        if (!fs.existsSync(gitkrakenLocal)) {
            return undefined;
        }
        const apps = fs
            .readdirSync(gitkrakenLocal)
            .filter((item) => item.startsWith("app"));
        apps.sort(natsort_1.default());
        const versions = [];
        for (const app of apps) {
            const matches = new RegExp('app-(\\d+\\.\\d+\\.\\d+)').exec(app);
            if (matches) {
                versions.push(matches[1]);
            }
        }
        const lastVersion = Patcher.findlastAppVersion(versions);
        if (!lastVersion)
            return undefined;
        let app = 'app-' + lastVersion;
        if (!app) {
            return undefined;
        }
        app = path.join(gitkrakenLocal, app, "resources/app.asar");
        return fs.existsSync(app) ? app : undefined;
    }
    static findAsarMacOS() {
        return Patcher.findAsarUnix("/Applications/GitKraken.app/Contents/Resources/app.asar");
    }
    static findlastAppVersion(versions) {
        if (versions.length === 0)
            return undefined;
        let max = versions[0];
        for (const version of versions) {
            if (semver.gt(version, max)) {
                max = version;
            }
        }
        return max;
    }
    static findAsar(dir) {
        if (dir) {
            return path.normalize(dir) + ".asar";
        }
        switch (platform_1.CURRENT_PLATFORM) {
            case platform_1.Platforms.linux:
                return Patcher.findAsarLinux();
            case platform_1.Platforms.windows:
                return Patcher.findAsarWindows();
            case platform_1.Platforms.macOS:
                return Patcher.findAsarMacOS();
        }
    }
    static findDir(asarFile) {
        return path.join(path.dirname(asarFile), path.basename(asarFile, path.extname(asarFile)));
    }
    constructor(asarFile, dir, ...features) {
        const _asar = asarFile || Patcher.findAsar(dir);
        if (!_asar) {
            throw new Error(`Can't find app.asar!`);
        }
        this._asar = _asar;
        this._dir = dir || Patcher.findDir(this._asar);
        this._features = features;
    }
    get asar() {
        return this._asar;
    }
    get dir() {
        return this._dir;
    }
    get features() {
        return this._features;
    }
    backupAsar() {
        const backup = `${this.asar}.${new Date().getTime()}.backup`;
        fs.copySync(this.asar, backup);
        return backup;
    }
    unpackAsar() {
        asar.extractAll(this.asar, this.dir);
    }
    packDirAsync() {
        return asar.createPackage(this.dir, this.asar);
    }
    removeDir() {
        fs.removeSync(this.dir);
    }
    patchDir() {
        for (const feature of this.features) {
            const patches = diff.parsePatch(fs.readFileSync(path.join(global_1.baseDir, "patches", `${feature}.diff`), "utf8"));
            for (const patch of patches) {
                const sourceData = fs.readFileSync(path.join(this.dir, patch.oldFileName), "utf8");
                if (patch.oldFileName !== patch.newFileName) {
                    fs.unlinkSync(path.join(this.dir, patch.oldFileName));
                }
                const sourcePatchedData = diff.applyPatch(sourceData, patch);
                fs.writeFileSync(path.join(this.dir, patch.newFileName), sourcePatchedData);
            }
        }
    }
}
exports.Patcher = Patcher;

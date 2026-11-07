# 第三方声明

## Signalsmith Stretch 1.3.2

共享 Web/Electron 播放链使用 Signalsmith Stretch Web Audio/WASM 发布文件实现变速不变调，运行时随应用本地加载。`playbackPitch.ts` 为固定版本的 JS 包装增加 dispose 消息及停止渲染判断，WASM 算法未修改；版本结构不符时明确报错，不静默套用适配。上游为 [Signalsmith Audio](https://github.com/Signalsmith-Audio/signalsmith-stretch)，采用 MIT 许可；完整版权与许可文本见 [signalsmith-stretch-MIT.txt](public/licenses/signalsmith-stretch-MIT.txt)。离线导出不使用此实时处理节点。

## Electron 45.1.0 与 electron-builder 26.18.1

Windows 桌面宿主使用 Electron（MIT），本地构建工具使用 electron-builder（MIT）；网页运行代码不导入两者。桌面运行库保留原分发中的 LICENSE 和 LICENSES.chromium.html 等许可文件；应用包携带本声明及共享 runtime 的许可资源。模型和外部资源库不随安装包分发，其许可仍按各自合同维护。

## Three.js 0.183.2

共享 Visualizer 与独立 Wallpaper Engine 运行包使用 Three.js，采用 MIT 许可。壁纸导出目录的 THIRD_PARTY_LICENSES.txt 随包包含安装版本的完整许可文本；构建从 node_modules/three/LICENSE 复制，不依赖远程服务。

## Mediabunny 1.61.6

Copyright (c) 2026-present, Vanilagy and contributors.

Mediabunny is used without source modifications for offline encoding and WebM muxing.
Its source is available at [Vanilagy/mediabunny](https://github.com/Vanilagy/mediabunny/tree/v1.61.6).
The library is distributed under the [Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/).
The complete license is distributed in [mediabunny-MPL-2.0.txt](public/licenses/mediabunny-MPL-2.0.txt).

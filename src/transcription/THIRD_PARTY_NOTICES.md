# Editor transcription model notices

模型独立下载并缓存，不随源码提交。固定 revision、实际 bytes 和 SHA-256 见
`model-artifacts.json`；下列说明是归因与许可边界，不是本项目质量验证。

## ADT_STR — CC BY-SA 4.0

Original authors: Melucci, Merialdo, Akama, **ADT_STR** (2026).
Original code and weights: https://github.com/pier-maker92/ADT_STR
License: https://creativecommons.org/licenses/by-sa/4.0/
Upstream weights: `Pierfrancesco/adt-str`, `setting-tau-0.8`, revision
`a33c5c6b191a4ca1e0f6dc22140947485eb36ce8`.

Conversion source: Bengisu Ozaydin / Coming Undone,
https://github.com/swwallowws/coming-undone/tree/ce82cf0841ddfb1157ab3928415e212ae97297b0/browser
Distributed conversion:
https://huggingface.co/swwallowws/coming-undone-browser-models/tree/89a917875e272bb492311624d7536b5e27604a64

The encoder and decoder weights were changed by the converter: exported to ONNX
with explicit attention and quantized to int8. These adapted weights retain
CC BY-SA 4.0. AudioNotSurfYet uses those files unchanged and verifies their bytes.
Any further adaptations of the weights must preserve attribution, identify changes,
and be shared under CC BY-SA 4.0. The separate model license does not describe the
license of user audio or imply blanket relicensing of this application's code.

This project's preprocessing and token adapters implement the published tensor,
spectral and custom vocabulary contracts in TypeScript. No upstream Python runtime,
training/export tool or conversion service is required by the product.

## Basic Pitch — Apache 2.0

Copyright 2022–2024 Spotify AB. Original model and reference inference:
https://github.com/spotify/basic-pitch/tree/9991303bba609a3b93089d13ec80d1d495083596

The ONNX file is the official v0.4.0 model, used unchanged. Its upstream Git blob
and the downloaded SHA-256 are both pinned. The reference note decoding algorithm
is adapted to TypeScript where indicated in source headers. License text:
`licenses/BasicPitch-LICENSE.txt`.

## HT-Demucs 6s — MIT

HT-Demucs: Meta Platforms, Inc. and affiliates,
https://github.com/facebookresearch/demucs/blob/v4.0.1/LICENSE

ONNX export and fp16-stored weights: StemSplit,
https://huggingface.co/StemSplitio/htdemucs-6s-onnx/tree/49df9b6989cf2150840ea65b0bef77a2e471b678
and https://github.com/StemSplit/demucs-onnx

The original and conversion licenses are MIT. The file is used unchanged; this
auxiliary analysis retains only guitar and piano and does not replace existing FT
stems. MIT text and shared ONNX Runtime attribution are preserved in
`../processing/THIRD_PARTY_NOTICES.md`.

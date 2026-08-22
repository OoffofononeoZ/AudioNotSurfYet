export interface AnalyzerData {
    title: string;
    abbreviation: string;
    belongsTo: string;
    detail: {
        description: string;
        usedfor: string;
        range: string;
    };
}

export const analyzerData: AnalyzerData[] = [
    {
        title: 'RMS',
        abbreviation: 'rms',
        belongsTo: '时域特征',
        detail: {
            description: '波形的均方根，对应其响度。对应 YAAFE 中的Energy特征，改编自 Loy 的《Musimathics》[1]。',
            usedfor: '大致了解信号的响度。',
            range: 'RMS 是一个正浮点数，仅受输入信号的长度和音量限制。更多信息请查阅维基百科条目（https://en.wikipedia.org/wiki/Root_mean_square）。在需要为每个音频特征设定上限的应用中使用 RMS 时，我们建议你测量将要提取特征的音频样本，确定一个合理的“最大值”作为你的上限，然后使用 Math.min 函数取当前 rms 值或你的最大阈值中的较小值。'
        }
    },
    {
        title: 'ZCR（过零率）',
        abbreviation: 'zcr',
        belongsTo: '时域特征',
        detail: {
            description: '信号在缓冲区中穿过零值的次数。',
            usedfor: '有助于区分打击乐声音和音高声音。打击乐声音在不同缓冲区上的 ZCR 是随机的，而音高声音则会返回一个更恒定的值。',
            range: '0 - ((缓冲区大小 / 2) - 1)。在 Meyda 中，默认缓冲区大小 (bufferSize) 为 512，因此默认 ZCR 范围是 0 - 255。'
        }
    },
    {
        title: 'Energy（能量）',
        abbreviation: 'energy',
        belongsTo: '时域特征',
        detail: {
            description: '平方信号的无穷积分。根据 Lathi [2] 的定义。',
            usedfor: '这是信号响度的另一个指标。',
            range: '0 - bufferSize，其中 0.0 表示非常安静，bufferSize 表示非常响亮。'
        }
    },
    {
        title: 'AmplitudeSpectrum（幅度谱）',
        abbreviation: 'amplitudeSpectrum',
        belongsTo: '频域特征',
        detail: {
            description: '这也被称为幅值谱。通过计算快速傅里叶变换 (FFT)，我们得到频域表示的信号。输出是一个数组，其中每个索引是一个频率区间（即包含关于一个频率范围的信息），包含一个复数值（实部和虚部）。幅度谱获取这个复数数组并计算每个索引的幅度。结果是信号中频率分布及其对应强度。如果你想了解更多关于傅里叶变换以及时域与频域分析之间的区别，这篇文章(https://www.mathworks.com/help/signal/ug/practical-introduction-to-frequency-domain-analysis.html)是一个不错的起点。',
            usedfor: '对于任何类型的音频分析都非常有用。事实上，Meyda 中提取的许多特征都基于此 :)',
            range: '一个大小为 FFT 一半的数组，包含关于 0 到一半采样率之间频率的信息。在 Meyda 中，默认采样率 (sampleRate) 为 44100Hz，FFT 大小等于缓冲区大小 (bufferSize)，默认为 512。'
        }
    },
    {
        title: 'Power Spectrum（功率谱）',
        abbreviation: 'powerSpectrum',
        belongsTo: '频域特征',
        detail: {
            description: '这是 amplitudeSpectrum 的平方。',
            usedfor: '与幅度谱相比，它更好地强调了频率区间之间的差异。',
            range: '一个大小为 FFT 一半的数组，包含关于 0 到一半采样率之间频率的信息。在 Meyda 中，默认采样率 (sampleRate) 为 44100Hz，FFT 大小等于缓冲区大小 (bufferSize)，默认为 512。'
        }
    },
    {
        title: 'Spectral Centroid（谱质心）',
        abbreviation: 'spectralCentroid',
        belongsTo: '频域特征',
        detail: {
            description: '表示给定声音“明亮度”的指标，代表频谱的重心。如果你把频谱想象成一个木块，并试图用手指（沿 X 轴）让它平衡，谱质心就是当它成功平衡时你手指“接触”到的频率。',
            usedfor: '如上所述，它量化了声音的“明亮度”。例如，可以用来区分低音吉他（低谱质心）和小号（高谱质心）。',
            range: '0 - FFT 大小的一半。在 Meyda 中，FFT 大小等于缓冲区大小 (bufferSize)，默认为 512。'
        }
    },
    {
        title: 'Spectral Flatness（谱平坦度）',
        abbreviation: 'spectralFlatness',
        belongsTo: '频域特征',
        detail: {
            description: '频谱的平坦度。通过几何平均值与算术平均值的比值计算得到。',
            usedfor: '确定声音的噪声程度。例如，纯正弦波的平坦度接近 0.0，而白噪声的平坦度接近 1.0。',
            range: '0.0 - 1.0，其中 0.0 表示不平坦，1.0 表示非常平坦。'
        }
    },
    {
        title: 'Spectral Flux（谱通量）',
        abbreviation: 'spectralFlux',
        belongsTo: '频域特征',
        detail: {
            description: '衡量信号频谱变化快慢的指标。通过计算当前频谱与前一帧频谱的差值得到。',
            usedfor: '通常对应于声音的感知“粗糙度”。例如，可用于确定声音的音色。',
            range: '起始于 0.0。没有上限范围，因为它取决于输入信号。'
        }
    },
    {
        title: 'Spectral Slope（谱斜率）',
        abbreviation: 'spectralSlope',
        belongsTo: '频域特征',
        detail: {
            description: '衡量频谱形状“倾斜”程度的指标。通过对幅度谱执行线性回归计算得到。',
            usedfor: '可用于区分不同的语音质量，例如嘶嘶声、呼吸声和常规语音。与谱质心和谱滚降密切相关。',
            range: '0.0 - 1.0'
        }
    },
    {
        title: 'Spectral Rolloff（谱滚降）',
        abbreviation: 'spectralRolloff',
        belongsTo: '频域特征',
        detail: {
            description: '包含了频谱 99% 能量之下的频率。',
            usedfor: '可用于近似信号中的最高频率。',
            range: '0 - 一半的采样率。在 Meyda 中，默认采样率 (sampleRate) 为 44100Hz。'
        }
    },
    {
        title: 'Spectral Spread（谱扩展度）',
        abbreviation: 'spectralSpread',
        belongsTo: '频域特征',
        detail: {
            description: '表示频率内容在整个频谱上的扩展程度。与频率带宽相对应。',
            usedfor: '可用于区分噪声音（高谱扩展度）和音高声音（低谱扩展度）。',
            range: '0 - FFT 大小的一半。在 Meyda 中，FFT 大小等于缓冲区大小 (bufferSize)，默认为 512。'
        }
    },
    {
        title: 'Spectral Skewness（谱偏度）',
        abbreviation: 'spectralSkewness',
        belongsTo: '频域特征',
        detail: {
            description: '表示频谱相对于其均值是否向特定值范围偏斜。',
            usedfor: '常用于了解声音的音色。',
            range: '可以是负数、正数或零。其中 0 表示关于均值对称，负数表示频率内容向均值右侧偏斜，正数表示频率内容向均值左侧偏斜。'
        }
    },
    {
        title: 'Spectral Kurtosis（谱峰度）',
        abbreviation: 'spectralKurtosis',
        belongsTo: '频域特征',
        detail: {
            description: '表示频谱尖锐程度的指标。可视为谱平坦度的反面。',
            usedfor: '常用于指示声音的“音调性 / 调性感”。',
            range: '0.0 - 1.0，其中 0.0 表示无调性感，1.0 表示非常有调性感。'
        }
    },
    {
        title: 'Spectral Crest（谱峰值因子）',
        abbreviation: 'spectralCrest',
        belongsTo: '频域特征',
        detail: {
            description: '最大幅度与整个帧的均方根之比。数值高表示与频谱的整体曲线相比存在一个响亮的峰值。',
            usedfor: '如果你正在分析的频谱中存在峰值，它可以帮助辨别频谱的峰值程度。',
            range: '范围是任意的，数值越高表示频谱中的峰值越极端。'
        }
    },
    {
        title: 'Chroma（色度）',
        abbreviation: 'chroma',
        belongsTo: '频域特征',
        detail: {
            description: '计算每个半音音高类别（C、C♯、D、D♯、E、F、F♯、G、G♯、A、A♯、B）在信号中存在的程度。',
            usedfor: '常用于分析录制音乐的和声内容，例如和弦或调性检测。',
            range: '每个音高类别的范围为 0.0 - 1.0。'
        }
    },
    {
        title: 'Loudness（响度）',
        abbreviation: 'loudness',
        belongsTo: '感知特征',
        detail: {
            description: '人类对频率的感知是非线性的。Bark 标度(https://en.wikipedia.org/wiki/Bark_scale)是为了使等距离对应等距离的频率感知而开发的。此特征输出一个包含两个值的对象：在此标度的每个步长（通常称为频带）上输入声音的响度 (`.specific`)，总共有 24 个频带;总响度 (`.total`)，它是 24 个 `.specific` 响度系数的总和。',
            usedfor: '可用于构建更符合人类响度感知的滤波器。',
            range: '响度特征提取器使用归一化后的频谱来计算各个 Bark 频带的能量，但能量本身之后不会被归一化。如果我们将其归一化到最大可能的声音，就会压缩范围，使得低响度值失去保真度。因此，我们将此特征的归一化留给值的消费者，因为归一化方法取决于具体用例。例如，实时音频可视化器可能会选择存储“迄今为止看到的最大响度”值并以此进行归一化，而在大量音频语料库上提取音频特征的系统则可能需要一个共享的归一化参考点，并应选择适合其用例和数据集的归一化方法。请务必记住你的归一化值和方法！我们建议进行实验，看看什么方法适合你的用例。如果你对如何改进响度特征或任何其他特征有想法，请告知我们。'
        }
    },
    {
        title: 'Perceptual Spread（感知扩展度）',
        abbreviation: 'perceptualSpread',
        belongsTo: '感知特征',
        detail: {
            description: '计算 .specific 响度系数在 Bark 标度上的扩展度。',
            usedfor: '表示一个声音将被感知为“丰富 / 饱满”的程度指标。',
            range: '0.0 - 1.0，其中 0.0 表示不“丰富”，1.0 表示非常“丰富”。'
        }
    },
    {
        title: 'Perceptual Sharpness（感知锐度）',
        abbreviation: 'perceptualSharpness',
        belongsTo: '感知特征',
        detail: {
            description: '基于 Bark 响度系数的声音感知“锐度”。',
            usedfor: '检测输入声音是否被感知为“尖锐”。例如，可用于区分小军鼓和低音鼓的声音。',
            range: '0.0 - 1.0，其中 0.0 表示不“尖锐”（如低音鼓），1.0 表示非常尖锐（如小军鼓）。'
        }
    },
    {
        title: 'Mel-Frequency Cepstral Coefficients（梅尔频率倒谱系数，MFCC）',
        abbreviation: 'mfcc',
        belongsTo: '感知特征',
        detail: {
            description: '由于人类不是以线性方式解读音高，因此人们设计了各种频率标度来表示人类听感中音高之间的距离。梅尔标度(https://en.wikipedia.org/wiki/Mel_scale)是其中之一，现在广泛用于语音相关应用。Meyda 的实现受到了 Huang [3]、Davis [4]、Grierson [5] 以及 librosa 库(https://github.com/bmcfee/librosa)的启发。',
            usedfor: '通常用于在自动语音识别 (ASR) 之前进行语音活动检测 (VAD)。',
            range: '一个表示每个梅尔频带强度的值数组。数组的默认大小为 13，但可通过 numberOfMFCCCoefficients 配置。'
        }
    },
    {
        title: 'Complex Spectrum（复频谱）',
        abbreviation: 'complexSpectrum',
        belongsTo: '实用提取器',
        detail: {
            description: '一个包含 FFT 实部和虚部的复数值数组 (ComplexArray)。',
            usedfor: '用于创建 amplitudeSpectrum。也用于进一步的信号处理，因为它包含频率和信号相位的信息。',
            range: '在本项目锁定的 Meyda 5.6.3 与 1024 bufferSize 下，real 和 imag 各返回完整 1024 个 FFT bin。前半段表示非负频率，后半段表示实数音频的负频率镜像；界面保留完整 bin 顺序，并从 real/imag 派生 magnitude 与 -π 到 π 的 phase。'
        }
    },
    {
        title: 'Buffer（缓冲区）',
        abbreviation: 'buffer',
        belongsTo: '实用提取器',
        detail: {
            description: '这是从麦克风、wav 文件或任何其他输入音频中读取音频时获得的原始音频。它被编码为 Float32Array。',
            usedfor: 'Meyda 中的所有时域特征都从这个缓冲区中提取。你也可以用它来可视化音频波形。',
            range: '一个大小为 bufferSize 的数组，其中每个值的范围可以在 -1.0 到 1.0 之间。'
        }
    }
];

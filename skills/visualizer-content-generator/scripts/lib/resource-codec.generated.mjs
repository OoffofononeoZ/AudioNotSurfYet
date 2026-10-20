// Generated standalone V2 codec snapshot; bundled from the approved runtime. No external imports.

// src/data/analyzerData.ts
var analyzerData = [
  {
    title: "Wallpaper Engine \u98CE\u683C\u9891\u8C31\uFF08\u8FD1\u4F3C\uFF09",
    abbreviation: "wallpaperEngineSpectrum",
    belongsTo: "\u7ACB\u4F53\u58F0\u9891\u8C31",
    detail: {
      description: "\u7528\u4E8E\u97F3\u9891\u54CD\u5E94\u52A8\u753B\u7684 128 \u9879\u9891\u8C31\uFF1A\u5DE6\u58F0\u9053 0\u201363\u3001\u53F3\u58F0\u9053 64\u2013127\uFF0C\u5404\u81EA\u4ECE\u4F4E\u9891\u5230\u9AD8\u9891\uFF0C\u7EA6 30Hz\u3002\u5B98\u65B9\u8BF4\u660E\u901A\u5E38\u4E3A 0\u20131\uFF0C\u77ED\u65F6\u53EF\u4EE5\u8D85\u8FC7 1\u3002\u672C\u9879\u76EE\u91C7\u7528\u5B9E\u6570 PCM \u7684\u72EC\u7ACB DFT\uFF1B\u6839\u636E\u5B98\u65B9\u5F00\u53D1\u8005 2017 \u5E74\u7684\u5386\u53F2\u8BF4\u660E\uFF0C\u5C06 DFT \u8F93\u5165\u7EA6 67% \u7528\u4E8E\u8FDE\u7EED PCM\u3001\u5176\u4F59\u5C3E\u90E8\u8865\u96F6\u3002640-bin \u626B\u63CF\u30010.25 \u6B21\u5E42\u5206\u9891\u4E0E\u907F\u514D\u8DF3\u8FC7\u9891\u6BB5\u7684\u89C4\u5219\u3001\u9891\u7387\u6743\u91CD\u3001\u6BCF 8 \u6BB5\u52A8\u6001\u589E\u76CA\u548C\u65F6\u95F4\u5E73\u6ED1\u53C2\u8003 OWE \u56FA\u5B9A\u63D0\u4EA4 4aaec723\uFF1B\u8FD9\u4E9B\u7EC6\u8282\u5E76\u975E\u5B98\u65B9\u5B8C\u6574\u89C4\u683C\u3002\u589E\u76CA\u4F7F\u7528\u9ED8\u8BA4\u5F55\u97F3\u97F3\u91CF\uFF0C\u5173\u95ED\u53EF\u9009\u9608\u503C\uFF0C\u4E0D\u6DFB\u52A0\u7C89\u566A\u6821\u51C6\u3001\u7A7A\u95F4\u6A21\u7CCA\u6216\u53BB\u96F6\u5C3E\u3002\u5355\u58F0\u9053\u590D\u5236\u4E3A\u53CC\u58F0\u9053\uFF0C\u591A\u58F0\u9053\u6309 speakers \u89C4\u5219\u4E0B\u6DF7\u3002\u9891\u7387\u8303\u56F4\u4E3A\u53C2\u8003 DFT bin \u8303\u56F4\uFF0C\u4E0D\u7528\u4E8E\u7CBE\u786E\u54CD\u5EA6\u6216\u58F0\u5B66\u6D4B\u91CF\uFF0C\u4E5F\u4E0D\u627F\u8BFA\u4E0E\u5F53\u524D Wallpaper Engine \u9010\u503C\u76F8\u540C\u3002",
      usedfor: "\u97F3\u9891\u54CD\u5E94\u52A8\u753B\u3002",
      range: "\u975E\u8D1F Float32\uFF0C\u901A\u5E38\u4E3A 0\u20131\uFF0C\u5141\u8BB8\u8D85\u8FC7 1\u3002"
    }
  },
  {
    title: "RMS",
    abbreviation: "rms",
    belongsTo: "\u65F6\u57DF\u7279\u5F81",
    detail: {
      description: "\u6CE2\u5F62\u7684\u5747\u65B9\u6839\uFF0C\u5BF9\u5E94\u5176\u54CD\u5EA6\u3002\u5BF9\u5E94 YAAFE \u4E2D\u7684Energy\u7279\u5F81\uFF0C\u6539\u7F16\u81EA Loy \u7684\u300AMusimathics\u300B[1]\u3002",
      usedfor: "\u5927\u81F4\u4E86\u89E3\u4FE1\u53F7\u7684\u54CD\u5EA6\u3002",
      range: "RMS \u662F\u4E00\u4E2A\u6B63\u6D6E\u70B9\u6570\uFF0C\u4EC5\u53D7\u8F93\u5165\u4FE1\u53F7\u7684\u957F\u5EA6\u548C\u97F3\u91CF\u9650\u5236\u3002\u66F4\u591A\u4FE1\u606F\u8BF7\u67E5\u9605\u7EF4\u57FA\u767E\u79D1\u6761\u76EE\uFF08https://en.wikipedia.org/wiki/Root_mean_square\uFF09\u3002\u5728\u9700\u8981\u4E3A\u6BCF\u4E2A\u97F3\u9891\u7279\u5F81\u8BBE\u5B9A\u4E0A\u9650\u7684\u5E94\u7528\u4E2D\u4F7F\u7528 RMS \u65F6\uFF0C\u6211\u4EEC\u5EFA\u8BAE\u4F60\u6D4B\u91CF\u5C06\u8981\u63D0\u53D6\u7279\u5F81\u7684\u97F3\u9891\u6837\u672C\uFF0C\u786E\u5B9A\u4E00\u4E2A\u5408\u7406\u7684\u201C\u6700\u5927\u503C\u201D\u4F5C\u4E3A\u4F60\u7684\u4E0A\u9650\uFF0C\u7136\u540E\u4F7F\u7528 Math.min \u51FD\u6570\u53D6\u5F53\u524D rms \u503C\u6216\u4F60\u7684\u6700\u5927\u9608\u503C\u4E2D\u7684\u8F83\u5C0F\u503C\u3002"
    }
  },
  {
    title: "ZCR\uFF08\u8FC7\u96F6\u7387\uFF09",
    abbreviation: "zcr",
    belongsTo: "\u65F6\u57DF\u7279\u5F81",
    detail: {
      description: "\u4FE1\u53F7\u5728\u7F13\u51B2\u533A\u4E2D\u7A7F\u8FC7\u96F6\u503C\u7684\u6B21\u6570\u3002",
      usedfor: "\u6709\u52A9\u4E8E\u533A\u5206\u6253\u51FB\u4E50\u58F0\u97F3\u548C\u97F3\u9AD8\u58F0\u97F3\u3002\u6253\u51FB\u4E50\u58F0\u97F3\u5728\u4E0D\u540C\u7F13\u51B2\u533A\u4E0A\u7684 ZCR \u662F\u968F\u673A\u7684\uFF0C\u800C\u97F3\u9AD8\u58F0\u97F3\u5219\u4F1A\u8FD4\u56DE\u4E00\u4E2A\u66F4\u6052\u5B9A\u7684\u503C\u3002",
      range: "0 - ((\u7F13\u51B2\u533A\u5927\u5C0F / 2) - 1)\u3002\u5728 Meyda \u4E2D\uFF0C\u9ED8\u8BA4\u7F13\u51B2\u533A\u5927\u5C0F (bufferSize) \u4E3A 512\uFF0C\u56E0\u6B64\u9ED8\u8BA4 ZCR \u8303\u56F4\u662F 0 - 255\u3002"
    }
  },
  {
    title: "Energy\uFF08\u80FD\u91CF\uFF09",
    abbreviation: "energy",
    belongsTo: "\u65F6\u57DF\u7279\u5F81",
    detail: {
      description: "\u5E73\u65B9\u4FE1\u53F7\u7684\u65E0\u7A77\u79EF\u5206\u3002\u6839\u636E Lathi [2] \u7684\u5B9A\u4E49\u3002",
      usedfor: "\u8FD9\u662F\u4FE1\u53F7\u54CD\u5EA6\u7684\u53E6\u4E00\u4E2A\u6307\u6807\u3002",
      range: "0 - bufferSize\uFF0C\u5176\u4E2D 0.0 \u8868\u793A\u975E\u5E38\u5B89\u9759\uFF0CbufferSize \u8868\u793A\u975E\u5E38\u54CD\u4EAE\u3002"
    }
  },
  {
    title: "AmplitudeSpectrum\uFF08\u5E45\u5EA6\u8C31\uFF09",
    abbreviation: "amplitudeSpectrum",
    belongsTo: "\u9891\u57DF\u7279\u5F81",
    detail: {
      description: "\u8FD9\u4E5F\u88AB\u79F0\u4E3A\u5E45\u503C\u8C31\u3002\u901A\u8FC7\u8BA1\u7B97\u5FEB\u901F\u5085\u91CC\u53F6\u53D8\u6362 (FFT)\uFF0C\u6211\u4EEC\u5F97\u5230\u9891\u57DF\u8868\u793A\u7684\u4FE1\u53F7\u3002\u8F93\u51FA\u662F\u4E00\u4E2A\u6570\u7EC4\uFF0C\u5176\u4E2D\u6BCF\u4E2A\u7D22\u5F15\u662F\u4E00\u4E2A\u9891\u7387\u533A\u95F4\uFF08\u5373\u5305\u542B\u5173\u4E8E\u4E00\u4E2A\u9891\u7387\u8303\u56F4\u7684\u4FE1\u606F\uFF09\uFF0C\u5305\u542B\u4E00\u4E2A\u590D\u6570\u503C\uFF08\u5B9E\u90E8\u548C\u865A\u90E8\uFF09\u3002\u5E45\u5EA6\u8C31\u83B7\u53D6\u8FD9\u4E2A\u590D\u6570\u6570\u7EC4\u5E76\u8BA1\u7B97\u6BCF\u4E2A\u7D22\u5F15\u7684\u5E45\u5EA6\u3002\u7ED3\u679C\u662F\u4FE1\u53F7\u4E2D\u9891\u7387\u5206\u5E03\u53CA\u5176\u5BF9\u5E94\u5F3A\u5EA6\u3002\u5982\u679C\u4F60\u60F3\u4E86\u89E3\u66F4\u591A\u5173\u4E8E\u5085\u91CC\u53F6\u53D8\u6362\u4EE5\u53CA\u65F6\u57DF\u4E0E\u9891\u57DF\u5206\u6790\u4E4B\u95F4\u7684\u533A\u522B\uFF0C\u8FD9\u7BC7\u6587\u7AE0(https://www.mathworks.com/help/signal/ug/practical-introduction-to-frequency-domain-analysis.html)\u662F\u4E00\u4E2A\u4E0D\u9519\u7684\u8D77\u70B9\u3002",
      usedfor: "\u5BF9\u4E8E\u4EFB\u4F55\u7C7B\u578B\u7684\u97F3\u9891\u5206\u6790\u90FD\u975E\u5E38\u6709\u7528\u3002\u4E8B\u5B9E\u4E0A\uFF0CMeyda \u4E2D\u63D0\u53D6\u7684\u8BB8\u591A\u7279\u5F81\u90FD\u57FA\u4E8E\u6B64 :)",
      range: "\u4E00\u4E2A\u5927\u5C0F\u4E3A FFT \u4E00\u534A\u7684\u6570\u7EC4\uFF0C\u5305\u542B\u5173\u4E8E 0 \u5230\u4E00\u534A\u91C7\u6837\u7387\u4E4B\u95F4\u9891\u7387\u7684\u4FE1\u606F\u3002\u5728 Meyda \u4E2D\uFF0C\u9ED8\u8BA4\u91C7\u6837\u7387 (sampleRate) \u4E3A 44100Hz\uFF0CFFT \u5927\u5C0F\u7B49\u4E8E\u7F13\u51B2\u533A\u5927\u5C0F (bufferSize)\uFF0C\u9ED8\u8BA4\u4E3A 512\u3002"
    }
  },
  {
    title: "Power Spectrum\uFF08\u529F\u7387\u8C31\uFF09",
    abbreviation: "powerSpectrum",
    belongsTo: "\u9891\u57DF\u7279\u5F81",
    detail: {
      description: "\u8FD9\u662F amplitudeSpectrum \u7684\u5E73\u65B9\u3002",
      usedfor: "\u4E0E\u5E45\u5EA6\u8C31\u76F8\u6BD4\uFF0C\u5B83\u66F4\u597D\u5730\u5F3A\u8C03\u4E86\u9891\u7387\u533A\u95F4\u4E4B\u95F4\u7684\u5DEE\u5F02\u3002",
      range: "\u4E00\u4E2A\u5927\u5C0F\u4E3A FFT \u4E00\u534A\u7684\u6570\u7EC4\uFF0C\u5305\u542B\u5173\u4E8E 0 \u5230\u4E00\u534A\u91C7\u6837\u7387\u4E4B\u95F4\u9891\u7387\u7684\u4FE1\u606F\u3002\u5728 Meyda \u4E2D\uFF0C\u9ED8\u8BA4\u91C7\u6837\u7387 (sampleRate) \u4E3A 44100Hz\uFF0CFFT \u5927\u5C0F\u7B49\u4E8E\u7F13\u51B2\u533A\u5927\u5C0F (bufferSize)\uFF0C\u9ED8\u8BA4\u4E3A 512\u3002"
    }
  },
  {
    title: "Spectral Centroid\uFF08\u8C31\u8D28\u5FC3\uFF09",
    abbreviation: "spectralCentroid",
    belongsTo: "\u9891\u57DF\u7279\u5F81",
    detail: {
      description: "\u8868\u793A\u7ED9\u5B9A\u58F0\u97F3\u201C\u660E\u4EAE\u5EA6\u201D\u7684\u6307\u6807\uFF0C\u4EE3\u8868\u9891\u8C31\u7684\u91CD\u5FC3\u3002\u5982\u679C\u4F60\u628A\u9891\u8C31\u60F3\u8C61\u6210\u4E00\u4E2A\u6728\u5757\uFF0C\u5E76\u8BD5\u56FE\u7528\u624B\u6307\uFF08\u6CBF X \u8F74\uFF09\u8BA9\u5B83\u5E73\u8861\uFF0C\u8C31\u8D28\u5FC3\u5C31\u662F\u5F53\u5B83\u6210\u529F\u5E73\u8861\u65F6\u4F60\u624B\u6307\u201C\u63A5\u89E6\u201D\u5230\u7684\u9891\u7387\u3002",
      usedfor: "\u5982\u4E0A\u6240\u8FF0\uFF0C\u5B83\u91CF\u5316\u4E86\u58F0\u97F3\u7684\u201C\u660E\u4EAE\u5EA6\u201D\u3002\u4F8B\u5982\uFF0C\u53EF\u4EE5\u7528\u6765\u533A\u5206\u4F4E\u97F3\u5409\u4ED6\uFF08\u4F4E\u8C31\u8D28\u5FC3\uFF09\u548C\u5C0F\u53F7\uFF08\u9AD8\u8C31\u8D28\u5FC3\uFF09\u3002",
      range: "0 - FFT \u5927\u5C0F\u7684\u4E00\u534A\u3002\u5728 Meyda \u4E2D\uFF0CFFT \u5927\u5C0F\u7B49\u4E8E\u7F13\u51B2\u533A\u5927\u5C0F (bufferSize)\uFF0C\u9ED8\u8BA4\u4E3A 512\u3002"
    }
  },
  {
    title: "Spectral Flatness\uFF08\u8C31\u5E73\u5766\u5EA6\uFF09",
    abbreviation: "spectralFlatness",
    belongsTo: "\u9891\u57DF\u7279\u5F81",
    detail: {
      description: "\u9891\u8C31\u7684\u5E73\u5766\u5EA6\u3002\u901A\u8FC7\u51E0\u4F55\u5E73\u5747\u503C\u4E0E\u7B97\u672F\u5E73\u5747\u503C\u7684\u6BD4\u503C\u8BA1\u7B97\u5F97\u5230\u3002",
      usedfor: "\u786E\u5B9A\u58F0\u97F3\u7684\u566A\u58F0\u7A0B\u5EA6\u3002\u4F8B\u5982\uFF0C\u7EAF\u6B63\u5F26\u6CE2\u7684\u5E73\u5766\u5EA6\u63A5\u8FD1 0.0\uFF0C\u800C\u767D\u566A\u58F0\u7684\u5E73\u5766\u5EA6\u63A5\u8FD1 1.0\u3002",
      range: "0.0 - 1.0\uFF0C\u5176\u4E2D 0.0 \u8868\u793A\u4E0D\u5E73\u5766\uFF0C1.0 \u8868\u793A\u975E\u5E38\u5E73\u5766\u3002"
    }
  },
  {
    title: "Spectral Flux\uFF08\u8C31\u901A\u91CF\uFF09",
    abbreviation: "spectralFlux",
    belongsTo: "\u9891\u57DF\u7279\u5F81",
    detail: {
      description: "\u8861\u91CF\u4FE1\u53F7\u9891\u8C31\u53D8\u5316\u5FEB\u6162\u7684\u6307\u6807\u3002\u901A\u8FC7\u8BA1\u7B97\u5F53\u524D\u9891\u8C31\u4E0E\u524D\u4E00\u5E27\u9891\u8C31\u7684\u5DEE\u503C\u5F97\u5230\u3002",
      usedfor: "\u901A\u5E38\u5BF9\u5E94\u4E8E\u58F0\u97F3\u7684\u611F\u77E5\u201C\u7C97\u7CD9\u5EA6\u201D\u3002\u4F8B\u5982\uFF0C\u53EF\u7528\u4E8E\u786E\u5B9A\u58F0\u97F3\u7684\u97F3\u8272\u3002",
      range: "\u8D77\u59CB\u4E8E 0.0\u3002\u6CA1\u6709\u4E0A\u9650\u8303\u56F4\uFF0C\u56E0\u4E3A\u5B83\u53D6\u51B3\u4E8E\u8F93\u5165\u4FE1\u53F7\u3002"
    }
  },
  {
    title: "Spectral Slope\uFF08\u8C31\u659C\u7387\uFF09",
    abbreviation: "spectralSlope",
    belongsTo: "\u9891\u57DF\u7279\u5F81",
    detail: {
      description: "\u8861\u91CF\u9891\u8C31\u5F62\u72B6\u201C\u503E\u659C\u201D\u7A0B\u5EA6\u7684\u6307\u6807\u3002\u901A\u8FC7\u5BF9\u5E45\u5EA6\u8C31\u6267\u884C\u7EBF\u6027\u56DE\u5F52\u8BA1\u7B97\u5F97\u5230\u3002",
      usedfor: "\u53EF\u7528\u4E8E\u533A\u5206\u4E0D\u540C\u7684\u8BED\u97F3\u8D28\u91CF\uFF0C\u4F8B\u5982\u5636\u5636\u58F0\u3001\u547C\u5438\u58F0\u548C\u5E38\u89C4\u8BED\u97F3\u3002\u4E0E\u8C31\u8D28\u5FC3\u548C\u8C31\u6EDA\u964D\u5BC6\u5207\u76F8\u5173\u3002",
      range: "0.0 - 1.0"
    }
  },
  {
    title: "Spectral Rolloff\uFF08\u8C31\u6EDA\u964D\uFF09",
    abbreviation: "spectralRolloff",
    belongsTo: "\u9891\u57DF\u7279\u5F81",
    detail: {
      description: "\u5305\u542B\u4E86\u9891\u8C31 99% \u80FD\u91CF\u4E4B\u4E0B\u7684\u9891\u7387\u3002",
      usedfor: "\u53EF\u7528\u4E8E\u8FD1\u4F3C\u4FE1\u53F7\u4E2D\u7684\u6700\u9AD8\u9891\u7387\u3002",
      range: "0 - \u4E00\u534A\u7684\u91C7\u6837\u7387\u3002\u5728 Meyda \u4E2D\uFF0C\u9ED8\u8BA4\u91C7\u6837\u7387 (sampleRate) \u4E3A 44100Hz\u3002"
    }
  },
  {
    title: "Spectral Spread\uFF08\u8C31\u6269\u5C55\u5EA6\uFF09",
    abbreviation: "spectralSpread",
    belongsTo: "\u9891\u57DF\u7279\u5F81",
    detail: {
      description: "\u8868\u793A\u9891\u7387\u5185\u5BB9\u5728\u6574\u4E2A\u9891\u8C31\u4E0A\u7684\u6269\u5C55\u7A0B\u5EA6\u3002\u4E0E\u9891\u7387\u5E26\u5BBD\u76F8\u5BF9\u5E94\u3002",
      usedfor: "\u53EF\u7528\u4E8E\u533A\u5206\u566A\u58F0\u97F3\uFF08\u9AD8\u8C31\u6269\u5C55\u5EA6\uFF09\u548C\u97F3\u9AD8\u58F0\u97F3\uFF08\u4F4E\u8C31\u6269\u5C55\u5EA6\uFF09\u3002",
      range: "0 - FFT \u5927\u5C0F\u7684\u4E00\u534A\u3002\u5728 Meyda \u4E2D\uFF0CFFT \u5927\u5C0F\u7B49\u4E8E\u7F13\u51B2\u533A\u5927\u5C0F (bufferSize)\uFF0C\u9ED8\u8BA4\u4E3A 512\u3002"
    }
  },
  {
    title: "Spectral Skewness\uFF08\u8C31\u504F\u5EA6\uFF09",
    abbreviation: "spectralSkewness",
    belongsTo: "\u9891\u57DF\u7279\u5F81",
    detail: {
      description: "\u8868\u793A\u9891\u8C31\u76F8\u5BF9\u4E8E\u5176\u5747\u503C\u662F\u5426\u5411\u7279\u5B9A\u503C\u8303\u56F4\u504F\u659C\u3002",
      usedfor: "\u5E38\u7528\u4E8E\u4E86\u89E3\u58F0\u97F3\u7684\u97F3\u8272\u3002",
      range: "\u53EF\u4EE5\u662F\u8D1F\u6570\u3001\u6B63\u6570\u6216\u96F6\u3002\u5176\u4E2D 0 \u8868\u793A\u5173\u4E8E\u5747\u503C\u5BF9\u79F0\uFF0C\u8D1F\u6570\u8868\u793A\u9891\u7387\u5185\u5BB9\u5411\u5747\u503C\u53F3\u4FA7\u504F\u659C\uFF0C\u6B63\u6570\u8868\u793A\u9891\u7387\u5185\u5BB9\u5411\u5747\u503C\u5DE6\u4FA7\u504F\u659C\u3002"
    }
  },
  {
    title: "Spectral Kurtosis\uFF08\u8C31\u5CF0\u5EA6\uFF09",
    abbreviation: "spectralKurtosis",
    belongsTo: "\u9891\u57DF\u7279\u5F81",
    detail: {
      description: "\u8868\u793A\u9891\u8C31\u5C16\u9510\u7A0B\u5EA6\u7684\u6307\u6807\u3002\u53EF\u89C6\u4E3A\u8C31\u5E73\u5766\u5EA6\u7684\u53CD\u9762\u3002",
      usedfor: "\u5E38\u7528\u4E8E\u6307\u793A\u58F0\u97F3\u7684\u201C\u97F3\u8C03\u6027 / \u8C03\u6027\u611F\u201D\u3002",
      range: "0.0 - 1.0\uFF0C\u5176\u4E2D 0.0 \u8868\u793A\u65E0\u8C03\u6027\u611F\uFF0C1.0 \u8868\u793A\u975E\u5E38\u6709\u8C03\u6027\u611F\u3002"
    }
  },
  {
    title: "Spectral Crest\uFF08\u8C31\u5CF0\u503C\u56E0\u5B50\uFF09",
    abbreviation: "spectralCrest",
    belongsTo: "\u9891\u57DF\u7279\u5F81",
    detail: {
      description: "\u6700\u5927\u5E45\u5EA6\u4E0E\u6574\u4E2A\u5E27\u7684\u5747\u65B9\u6839\u4E4B\u6BD4\u3002\u6570\u503C\u9AD8\u8868\u793A\u4E0E\u9891\u8C31\u7684\u6574\u4F53\u66F2\u7EBF\u76F8\u6BD4\u5B58\u5728\u4E00\u4E2A\u54CD\u4EAE\u7684\u5CF0\u503C\u3002",
      usedfor: "\u5982\u679C\u4F60\u6B63\u5728\u5206\u6790\u7684\u9891\u8C31\u4E2D\u5B58\u5728\u5CF0\u503C\uFF0C\u5B83\u53EF\u4EE5\u5E2E\u52A9\u8FA8\u522B\u9891\u8C31\u7684\u5CF0\u503C\u7A0B\u5EA6\u3002",
      range: "\u8303\u56F4\u662F\u4EFB\u610F\u7684\uFF0C\u6570\u503C\u8D8A\u9AD8\u8868\u793A\u9891\u8C31\u4E2D\u7684\u5CF0\u503C\u8D8A\u6781\u7AEF\u3002"
    }
  },
  {
    title: "Chroma\uFF08\u8272\u5EA6\uFF09",
    abbreviation: "chroma",
    belongsTo: "\u9891\u57DF\u7279\u5F81",
    detail: {
      description: "\u8BA1\u7B97\u6BCF\u4E2A\u534A\u97F3\u97F3\u9AD8\u7C7B\u522B\uFF08C\u3001C\u266F\u3001D\u3001D\u266F\u3001E\u3001F\u3001F\u266F\u3001G\u3001G\u266F\u3001A\u3001A\u266F\u3001B\uFF09\u5728\u4FE1\u53F7\u4E2D\u5B58\u5728\u7684\u7A0B\u5EA6\u3002",
      usedfor: "\u5E38\u7528\u4E8E\u5206\u6790\u5F55\u5236\u97F3\u4E50\u7684\u548C\u58F0\u5185\u5BB9\uFF0C\u4F8B\u5982\u548C\u5F26\u6216\u8C03\u6027\u68C0\u6D4B\u3002",
      range: "\u6BCF\u4E2A\u97F3\u9AD8\u7C7B\u522B\u7684\u8303\u56F4\u4E3A 0.0 - 1.0\u3002"
    }
  },
  {
    title: "Loudness\uFF08\u54CD\u5EA6\uFF09",
    abbreviation: "loudness",
    belongsTo: "\u611F\u77E5\u7279\u5F81",
    detail: {
      description: "\u4EBA\u7C7B\u5BF9\u9891\u7387\u7684\u611F\u77E5\u662F\u975E\u7EBF\u6027\u7684\u3002Bark \u6807\u5EA6(https://en.wikipedia.org/wiki/Bark_scale)\u662F\u4E3A\u4E86\u4F7F\u7B49\u8DDD\u79BB\u5BF9\u5E94\u7B49\u8DDD\u79BB\u7684\u9891\u7387\u611F\u77E5\u800C\u5F00\u53D1\u7684\u3002\u6B64\u7279\u5F81\u8F93\u51FA\u4E00\u4E2A\u5305\u542B\u4E24\u4E2A\u503C\u7684\u5BF9\u8C61\uFF1A\u5728\u6B64\u6807\u5EA6\u7684\u6BCF\u4E2A\u6B65\u957F\uFF08\u901A\u5E38\u79F0\u4E3A\u9891\u5E26\uFF09\u4E0A\u8F93\u5165\u58F0\u97F3\u7684\u54CD\u5EA6 (`.specific`)\uFF0C\u603B\u5171\u6709 24 \u4E2A\u9891\u5E26;\u603B\u54CD\u5EA6 (`.total`)\uFF0C\u5B83\u662F 24 \u4E2A `.specific` \u54CD\u5EA6\u7CFB\u6570\u7684\u603B\u548C\u3002",
      usedfor: "\u53EF\u7528\u4E8E\u6784\u5EFA\u66F4\u7B26\u5408\u4EBA\u7C7B\u54CD\u5EA6\u611F\u77E5\u7684\u6EE4\u6CE2\u5668\u3002",
      range: "\u54CD\u5EA6\u7279\u5F81\u63D0\u53D6\u5668\u4F7F\u7528\u5F52\u4E00\u5316\u540E\u7684\u9891\u8C31\u6765\u8BA1\u7B97\u5404\u4E2A Bark \u9891\u5E26\u7684\u80FD\u91CF\uFF0C\u4F46\u80FD\u91CF\u672C\u8EAB\u4E4B\u540E\u4E0D\u4F1A\u88AB\u5F52\u4E00\u5316\u3002\u5982\u679C\u6211\u4EEC\u5C06\u5176\u5F52\u4E00\u5316\u5230\u6700\u5927\u53EF\u80FD\u7684\u58F0\u97F3\uFF0C\u5C31\u4F1A\u538B\u7F29\u8303\u56F4\uFF0C\u4F7F\u5F97\u4F4E\u54CD\u5EA6\u503C\u5931\u53BB\u4FDD\u771F\u5EA6\u3002\u56E0\u6B64\uFF0C\u6211\u4EEC\u5C06\u6B64\u7279\u5F81\u7684\u5F52\u4E00\u5316\u7559\u7ED9\u503C\u7684\u6D88\u8D39\u8005\uFF0C\u56E0\u4E3A\u5F52\u4E00\u5316\u65B9\u6CD5\u53D6\u51B3\u4E8E\u5177\u4F53\u7528\u4F8B\u3002\u4F8B\u5982\uFF0C\u5B9E\u65F6\u97F3\u9891\u53EF\u89C6\u5316\u5668\u53EF\u80FD\u4F1A\u9009\u62E9\u5B58\u50A8\u201C\u8FC4\u4ECA\u4E3A\u6B62\u770B\u5230\u7684\u6700\u5927\u54CD\u5EA6\u201D\u503C\u5E76\u4EE5\u6B64\u8FDB\u884C\u5F52\u4E00\u5316\uFF0C\u800C\u5728\u5927\u91CF\u97F3\u9891\u8BED\u6599\u5E93\u4E0A\u63D0\u53D6\u97F3\u9891\u7279\u5F81\u7684\u7CFB\u7EDF\u5219\u53EF\u80FD\u9700\u8981\u4E00\u4E2A\u5171\u4EAB\u7684\u5F52\u4E00\u5316\u53C2\u8003\u70B9\uFF0C\u5E76\u5E94\u9009\u62E9\u9002\u5408\u5176\u7528\u4F8B\u548C\u6570\u636E\u96C6\u7684\u5F52\u4E00\u5316\u65B9\u6CD5\u3002\u8BF7\u52A1\u5FC5\u8BB0\u4F4F\u4F60\u7684\u5F52\u4E00\u5316\u503C\u548C\u65B9\u6CD5\uFF01\u6211\u4EEC\u5EFA\u8BAE\u8FDB\u884C\u5B9E\u9A8C\uFF0C\u770B\u770B\u4EC0\u4E48\u65B9\u6CD5\u9002\u5408\u4F60\u7684\u7528\u4F8B\u3002\u5982\u679C\u4F60\u5BF9\u5982\u4F55\u6539\u8FDB\u54CD\u5EA6\u7279\u5F81\u6216\u4EFB\u4F55\u5176\u4ED6\u7279\u5F81\u6709\u60F3\u6CD5\uFF0C\u8BF7\u544A\u77E5\u6211\u4EEC\u3002"
    }
  },
  {
    title: "Perceptual Spread\uFF08\u611F\u77E5\u6269\u5C55\u5EA6\uFF09",
    abbreviation: "perceptualSpread",
    belongsTo: "\u611F\u77E5\u7279\u5F81",
    detail: {
      description: "\u8BA1\u7B97 .specific \u54CD\u5EA6\u7CFB\u6570\u5728 Bark \u6807\u5EA6\u4E0A\u7684\u6269\u5C55\u5EA6\u3002",
      usedfor: "\u8868\u793A\u4E00\u4E2A\u58F0\u97F3\u5C06\u88AB\u611F\u77E5\u4E3A\u201C\u4E30\u5BCC / \u9971\u6EE1\u201D\u7684\u7A0B\u5EA6\u6307\u6807\u3002",
      range: "0.0 - 1.0\uFF0C\u5176\u4E2D 0.0 \u8868\u793A\u4E0D\u201C\u4E30\u5BCC\u201D\uFF0C1.0 \u8868\u793A\u975E\u5E38\u201C\u4E30\u5BCC\u201D\u3002"
    }
  },
  {
    title: "Perceptual Sharpness\uFF08\u611F\u77E5\u9510\u5EA6\uFF09",
    abbreviation: "perceptualSharpness",
    belongsTo: "\u611F\u77E5\u7279\u5F81",
    detail: {
      description: "\u57FA\u4E8E Bark \u54CD\u5EA6\u7CFB\u6570\u7684\u58F0\u97F3\u611F\u77E5\u201C\u9510\u5EA6\u201D\u3002",
      usedfor: "\u68C0\u6D4B\u8F93\u5165\u58F0\u97F3\u662F\u5426\u88AB\u611F\u77E5\u4E3A\u201C\u5C16\u9510\u201D\u3002\u4F8B\u5982\uFF0C\u53EF\u7528\u4E8E\u533A\u5206\u5C0F\u519B\u9F13\u548C\u4F4E\u97F3\u9F13\u7684\u58F0\u97F3\u3002",
      range: "0.0 - 1.0\uFF0C\u5176\u4E2D 0.0 \u8868\u793A\u4E0D\u201C\u5C16\u9510\u201D\uFF08\u5982\u4F4E\u97F3\u9F13\uFF09\uFF0C1.0 \u8868\u793A\u975E\u5E38\u5C16\u9510\uFF08\u5982\u5C0F\u519B\u9F13\uFF09\u3002"
    }
  },
  {
    title: "Mel-Frequency Cepstral Coefficients\uFF08\u6885\u5C14\u9891\u7387\u5012\u8C31\u7CFB\u6570\uFF0CMFCC\uFF09",
    abbreviation: "mfcc",
    belongsTo: "\u611F\u77E5\u7279\u5F81",
    detail: {
      description: "\u7531\u4E8E\u4EBA\u7C7B\u4E0D\u662F\u4EE5\u7EBF\u6027\u65B9\u5F0F\u89E3\u8BFB\u97F3\u9AD8\uFF0C\u56E0\u6B64\u4EBA\u4EEC\u8BBE\u8BA1\u4E86\u5404\u79CD\u9891\u7387\u6807\u5EA6\u6765\u8868\u793A\u4EBA\u7C7B\u542C\u611F\u4E2D\u97F3\u9AD8\u4E4B\u95F4\u7684\u8DDD\u79BB\u3002\u6885\u5C14\u6807\u5EA6(https://en.wikipedia.org/wiki/Mel_scale)\u662F\u5176\u4E2D\u4E4B\u4E00\uFF0C\u73B0\u5728\u5E7F\u6CDB\u7528\u4E8E\u8BED\u97F3\u76F8\u5173\u5E94\u7528\u3002Meyda \u7684\u5B9E\u73B0\u53D7\u5230\u4E86 Huang [3]\u3001Davis [4]\u3001Grierson [5] \u4EE5\u53CA librosa \u5E93(https://github.com/bmcfee/librosa)\u7684\u542F\u53D1\u3002",
      usedfor: "\u901A\u5E38\u7528\u4E8E\u5728\u81EA\u52A8\u8BED\u97F3\u8BC6\u522B (ASR) \u4E4B\u524D\u8FDB\u884C\u8BED\u97F3\u6D3B\u52A8\u68C0\u6D4B (VAD)\u3002",
      range: "\u4E00\u4E2A\u8868\u793A\u6BCF\u4E2A\u6885\u5C14\u9891\u5E26\u5F3A\u5EA6\u7684\u503C\u6570\u7EC4\u3002\u6570\u7EC4\u7684\u9ED8\u8BA4\u5927\u5C0F\u4E3A 13\uFF0C\u4F46\u53EF\u901A\u8FC7 numberOfMFCCCoefficients \u914D\u7F6E\u3002"
    }
  },
  {
    title: "Complex Spectrum\uFF08\u590D\u9891\u8C31\uFF09",
    abbreviation: "complexSpectrum",
    belongsTo: "\u5B9E\u7528\u63D0\u53D6\u5668",
    detail: {
      description: "\u4E00\u4E2A\u5305\u542B FFT \u5B9E\u90E8\u548C\u865A\u90E8\u7684\u590D\u6570\u503C\u6570\u7EC4 (ComplexArray)\u3002",
      usedfor: "\u7528\u4E8E\u521B\u5EFA amplitudeSpectrum\u3002\u4E5F\u7528\u4E8E\u8FDB\u4E00\u6B65\u7684\u4FE1\u53F7\u5904\u7406\uFF0C\u56E0\u4E3A\u5B83\u5305\u542B\u9891\u7387\u548C\u4FE1\u53F7\u76F8\u4F4D\u7684\u4FE1\u606F\u3002",
      range: "\u5728\u672C\u9879\u76EE\u9501\u5B9A\u7684 Meyda 5.6.3 \u4E0E 1024 bufferSize \u4E0B\uFF0Creal \u548C imag \u5404\u8FD4\u56DE\u5B8C\u6574 1024 \u4E2A FFT bin\u3002\u524D\u534A\u6BB5\u8868\u793A\u975E\u8D1F\u9891\u7387\uFF0C\u540E\u534A\u6BB5\u8868\u793A\u5B9E\u6570\u97F3\u9891\u7684\u8D1F\u9891\u7387\u955C\u50CF\uFF1B\u754C\u9762\u4FDD\u7559\u5B8C\u6574 bin \u987A\u5E8F\uFF0C\u5E76\u4ECE real/imag \u6D3E\u751F magnitude \u4E0E -\u03C0 \u5230 \u03C0 \u7684 phase\u3002"
    }
  },
  {
    title: "Buffer\uFF08\u7F13\u51B2\u533A\uFF09",
    abbreviation: "buffer",
    belongsTo: "\u5B9E\u7528\u63D0\u53D6\u5668",
    detail: {
      description: "\u8FD9\u662F\u4ECE\u9EA6\u514B\u98CE\u3001wav \u6587\u4EF6\u6216\u4EFB\u4F55\u5176\u4ED6\u8F93\u5165\u97F3\u9891\u4E2D\u8BFB\u53D6\u97F3\u9891\u65F6\u83B7\u5F97\u7684\u539F\u59CB\u97F3\u9891\u3002\u5B83\u88AB\u7F16\u7801\u4E3A Float32Array\u3002",
      usedfor: "Meyda \u4E2D\u7684\u6240\u6709\u65F6\u57DF\u7279\u5F81\u90FD\u4ECE\u8FD9\u4E2A\u7F13\u51B2\u533A\u4E2D\u63D0\u53D6\u3002\u4F60\u4E5F\u53EF\u4EE5\u7528\u5B83\u6765\u53EF\u89C6\u5316\u97F3\u9891\u6CE2\u5F62\u3002",
      range: "\u4E00\u4E2A\u5927\u5C0F\u4E3A bufferSize \u7684\u6570\u7EC4\uFF0C\u5176\u4E2D\u6BCF\u4E2A\u503C\u7684\u8303\u56F4\u53EF\u4EE5\u5728 -1.0 \u5230 1.0 \u4E4B\u95F4\u3002"
    }
  }
];

// src/analysis/types.ts
var FEATURE_IDS = [
  "wallpaperEngineSpectrum",
  "rms",
  "zcr",
  "energy",
  "amplitudeSpectrum",
  "powerSpectrum",
  "spectralCentroid",
  "spectralFlatness",
  "spectralFlux",
  "spectralSlope",
  "spectralRolloff",
  "spectralSpread",
  "spectralSkewness",
  "spectralKurtosis",
  "spectralCrest",
  "chroma",
  "loudness",
  "perceptualSpread",
  "perceptualSharpness",
  "mfcc",
  "complexSpectrum",
  "buffer"
];
var M7_FEATURE_IDS = [
  "rms",
  "amplitudeSpectrum",
  "chroma"
];
var M8_SCALAR_FEATURE_IDS = [
  "zcr",
  "energy",
  "spectralCentroid",
  "spectralFlatness",
  "spectralFlux",
  "spectralSlope",
  "spectralRolloff",
  "spectralSpread",
  "spectralSkewness",
  "spectralKurtosis",
  "spectralCrest",
  "perceptualSpread",
  "perceptualSharpness"
];
var M8_AVAILABLE_FEATURE_IDS = [
  ...M7_FEATURE_IDS,
  ...M8_SCALAR_FEATURE_IDS
];
var M9_FEATURE_IDS = [
  "powerSpectrum",
  "mfcc",
  "buffer"
];
var M9_AVAILABLE_FEATURE_IDS = [
  ...M8_AVAILABLE_FEATURE_IDS,
  ...M9_FEATURE_IDS
];
var M10_FEATURE_IDS = [
  "loudness",
  "complexSpectrum"
];
var M10_AVAILABLE_FEATURE_IDS = [
  ...M9_AVAILABLE_FEATURE_IDS,
  ...M10_FEATURE_IDS
];
var isFeatureId = (value) => typeof value === "string" && FEATURE_IDS.includes(value);

// src/analysis/featureRegistry.ts
var details = new Map(
  analyzerData.map((entry) => [entry.abbreviation, entry])
);
var defineFeature = (id, input) => {
  const detail = details.get(id);
  if (!detail) {
    throw new Error(`Missing analyzerData entry for ${id}.`);
  }
  return {
    id,
    meydaKey: id,
    label: detail.title,
    description: detail.detail.description,
    extractionSource: "meyda",
    ...input
  };
};
var scalar = (id, input) => defineFeature(id, {
  ...input,
  outputShape: "scalar",
  renderer: "scalar-line",
  dimensions: () => []
});
var FEATURE_REGISTRY = {
  wallpaperEngineSpectrum: defineFeature("wallpaperEngineSpectrum", {
    outputShape: "frequency-vector",
    renderer: "stereo-spectrum",
    range: { min: 0, unit: "WE approximate" },
    dependencies: [],
    dimensions: () => [128],
    deliveryMilestone: "M10",
    workerSupported: true,
    extractionSource: "project-wallpaper-spectrum-v1"
  }),
  rms: scalar("rms", {
    range: { min: 0 },
    dependencies: [],
    deliveryMilestone: "M7",
    workerSupported: true
  }),
  zcr: scalar("zcr", {
    range: { min: 0 },
    dependencies: [],
    deliveryMilestone: "M8",
    workerSupported: true,
    zeroEnergyValue: 0
  }),
  energy: scalar("energy", {
    range: { min: 0 },
    dependencies: [],
    deliveryMilestone: "M8",
    workerSupported: true,
    zeroEnergyValue: 0
  }),
  amplitudeSpectrum: defineFeature("amplitudeSpectrum", {
    outputShape: "frequency-vector",
    renderer: "frequency-heatmap",
    range: { min: 0 },
    dependencies: [],
    dimensions: (config) => [config.frameSize / 2],
    deliveryMilestone: "M7",
    workerSupported: true
  }),
  powerSpectrum: defineFeature("powerSpectrum", {
    outputShape: "frequency-vector",
    renderer: "frequency-heatmap",
    range: { min: 0 },
    dependencies: ["amplitudeSpectrum"],
    dimensions: (config) => [config.frameSize / 2],
    deliveryMilestone: "M9",
    workerSupported: true
  }),
  spectralCentroid: scalar("spectralCentroid", {
    range: { min: 0, unit: "bin" },
    dependencies: ["amplitudeSpectrum"],
    deliveryMilestone: "M8",
    workerSupported: true,
    zeroEnergyValue: 0
  }),
  spectralFlatness: scalar("spectralFlatness", {
    range: { min: 0, max: 1 },
    dependencies: ["amplitudeSpectrum"],
    deliveryMilestone: "M8",
    workerSupported: true,
    zeroEnergyValue: 0
  }),
  spectralFlux: scalar("spectralFlux", {
    range: { min: 0 },
    dependencies: ["amplitudeSpectrum"],
    deliveryMilestone: "M8",
    workerSupported: true,
    extractionSource: "project-spectral-flux-v1",
    zeroEnergyValue: 0
  }),
  spectralSlope: scalar("spectralSlope", {
    range: { signed: true },
    dependencies: ["amplitudeSpectrum"],
    deliveryMilestone: "M8",
    workerSupported: true,
    zeroEnergyValue: 0
  }),
  spectralRolloff: scalar("spectralRolloff", {
    range: { min: 0, unit: "Hz" },
    dependencies: ["amplitudeSpectrum"],
    deliveryMilestone: "M8",
    workerSupported: true,
    zeroEnergyValue: 0
  }),
  spectralSpread: scalar("spectralSpread", {
    range: { min: 0, unit: "bin" },
    dependencies: ["amplitudeSpectrum", "spectralCentroid"],
    deliveryMilestone: "M8",
    workerSupported: true,
    zeroEnergyValue: 0
  }),
  spectralSkewness: scalar("spectralSkewness", {
    range: { signed: true },
    dependencies: ["amplitudeSpectrum", "spectralCentroid"],
    deliveryMilestone: "M8",
    workerSupported: true,
    zeroEnergyValue: 0
  }),
  spectralKurtosis: scalar("spectralKurtosis", {
    range: { min: 0 },
    dependencies: ["amplitudeSpectrum", "spectralCentroid"],
    deliveryMilestone: "M8",
    workerSupported: true,
    zeroEnergyValue: 0
  }),
  spectralCrest: scalar("spectralCrest", {
    range: { min: 0 },
    dependencies: ["amplitudeSpectrum"],
    deliveryMilestone: "M8",
    workerSupported: true,
    zeroEnergyValue: 0
  }),
  chroma: defineFeature("chroma", {
    outputShape: "category-vector",
    renderer: "chroma-heatmap",
    range: { min: 0, max: 1 },
    dependencies: ["amplitudeSpectrum"],
    dimensions: () => [12],
    deliveryMilestone: "M7",
    workerSupported: true
  }),
  loudness: defineFeature("loudness", {
    outputShape: "loudness-structure",
    renderer: "loudness",
    range: { min: 0 },
    dependencies: ["amplitudeSpectrum"],
    dimensions: () => [24, 1],
    deliveryMilestone: "M10",
    workerSupported: true
  }),
  perceptualSpread: scalar("perceptualSpread", {
    range: { min: 0, max: 1 },
    dependencies: ["loudness"],
    deliveryMilestone: "M8",
    workerSupported: true,
    zeroEnergyValue: 0
  }),
  perceptualSharpness: scalar("perceptualSharpness", {
    range: { min: 0 },
    dependencies: ["loudness"],
    deliveryMilestone: "M8",
    workerSupported: true,
    zeroEnergyValue: 0
  }),
  mfcc: defineFeature("mfcc", {
    outputShape: "category-vector",
    renderer: "frequency-heatmap",
    range: { signed: true },
    dependencies: ["amplitudeSpectrum", "powerSpectrum"],
    dimensions: (config) => [config.numberOfMFCCCoefficients],
    deliveryMilestone: "M9",
    workerSupported: true
  }),
  complexSpectrum: defineFeature("complexSpectrum", {
    outputShape: "complex-spectrum",
    renderer: "complex-spectrum",
    range: { signed: true },
    dependencies: [],
    dimensions: (config) => [config.frameSize, 2],
    deliveryMilestone: "M10",
    workerSupported: true
  }),
  buffer: defineFeature("buffer", {
    outputShape: "waveform",
    renderer: "waveform",
    range: { min: -1, max: 1, signed: true },
    dependencies: [],
    dimensions: (config) => [config.frameSize],
    deliveryMilestone: "M9",
    workerSupported: true
  })
};

// src/visualizer/projectValidation.ts
var COMPONENTS = /* @__PURE__ */ new Set([
  "default",
  "total",
  "specific",
  "real",
  "imag",
  "magnitude",
  "phase"
]);
var VisualizerProjectValidationError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "VisualizerProjectValidationError";
    this.code = code;
  }
};
var invalid = (message) => {
  throw new VisualizerProjectValidationError("invalid-schema", message);
};
var isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var record = (value, path) => {
  if (!isRecord(value)) invalid(`${path} must be an object.`);
  return value;
};
var keys = (value, required, optional = [], path = "value") => {
  const allowed = /* @__PURE__ */ new Set([...required, ...optional]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) invalid(`${path}.${key} is not supported.`);
  }
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      invalid(`${path}.${key} is required.`);
    }
  }
};
var finite = (value, path) => {
  if (typeof value !== "number" || !Number.isFinite(value) || Object.is(value, -0)) {
    invalid(`${path} must be a finite number other than -0.`);
  }
  return value;
};
var integer = (value, path) => {
  const result = finite(value, path);
  if (!Number.isInteger(result)) invalid(`${path} must be an integer.`);
  return result;
};
var assertInRange = (value, range2, path) => {
  if (value < range2.min || value > range2.max) {
    invalid(`${path} must be between ${range2.min} and ${range2.max}.`);
  }
  if (range2.integer && !Number.isInteger(value)) {
    invalid(`${path} must be an integer.`);
  }
};
var text = (value, path) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    invalid(`${path} must be a non-empty string.`);
  }
  return value;
};
var canonicalConstant = (input, parameter3, path) => {
  if (parameter3.valueKind === "number") {
    const value = finite(input, path);
    const range2 = parameter3.range;
    if (!range2) return invalid(`${path} has no registered numeric range.`);
    assertInRange(value, range2, path);
    return value;
  }
  if (parameter3.valueKind === "boolean") {
    if (typeof input !== "boolean") invalid(`${path} must be boolean.`);
    return input;
  }
  if (parameter3.valueKind === "color") {
    const value = text(input, path);
    if (!/^#[0-9a-f]{6}$/i.test(value)) invalid(`${path} must be a six-digit color.`);
    return value;
  }
  if (!Array.isArray(input)) invalid(`${path} must be a numeric array.`);
  const values = input;
  if (values.length === 0 && !parameter3.allowEmptyVector) {
    invalid(`${path} must not be empty.`);
  }
  for (let index = 0; index < values.length; index += 1) {
    if (!(index in values)) invalid(`${path} must not be sparse.`);
  }
  return values.map((entry, index) => {
    const value = finite(entry, `${path}[${index}]`);
    if (parameter3.vectorElementRange) {
      assertInRange(value, parameter3.vectorElementRange, `${path}[${index}]`);
    }
    return value;
  });
};
var canonicalProjection = (input, path) => {
  const value = record(input, path);
  const kind = value.kind;
  if (["scalar", "full", "mean", "max", "peak"].includes(String(kind))) {
    keys(value, ["kind"], [], path);
    return { kind };
  }
  if (kind === "bin") {
    keys(value, ["kind", "index"], [], path);
    const index = integer(value.index, `${path}.index`);
    if (index < 0) invalid(`${path}.index is invalid.`);
    return { kind, index };
  }
  if (kind === "band") {
    keys(value, ["kind", "start", "end"], [], path);
    const start = integer(value.start, `${path}.start`);
    const end = integer(value.end, `${path}.end`);
    if (start < 0 || end <= start) invalid(`${path} is not a half-open band.`);
    return { kind, start, end };
  }
  return invalid(`${path}.kind is invalid.`);
};
var projectionLength = (featureId, component) => {
  const definition = FEATURE_REGISTRY[featureId];
  if (definition.outputShape === "scalar") {
    if (component !== "default") invalid(`${featureId} only supports the default scalar component.`);
    return null;
  }
  if (definition.outputShape === "loudness-structure") {
    if (component === "total") return null;
    if (component === "specific") return 24;
    invalid("loudness requires total or specific component.");
  }
  if (definition.outputShape === "complex-spectrum") {
    if (!["real", "imag", "magnitude", "phase"].includes(component)) {
      invalid("complexSpectrum requires a complex component.");
    }
    return 1024;
  }
  if (component !== "default") invalid(`${featureId} only supports the default component.`);
  if (definition.outputShape === "frequency-vector") return 512;
  if (definition.outputShape === "category-vector") {
    return featureId === "mfcc" ? 13 : 12;
  }
  if (definition.outputShape === "waveform") return 1024;
  return invalid(`${featureId} has an unsupported projection shape.`);
};
var assertProjectionCompatible = (featureId, component, projection, parameter3) => {
  const length = projectionLength(featureId, component);
  if (length === null) {
    if (projection.kind !== "scalar" || parameter3.valueKind !== "number") {
      invalid(`${featureId} must use scalar projection for a numeric parameter.`);
    }
    return;
  }
  if (projection.kind === "scalar") invalid(`${featureId} is not scalar.`);
  if (projection.kind === "full" && parameter3.valueKind !== "vector") {
    invalid("full projection requires a vector parameter.");
  }
  if (projection.kind !== "full" && parameter3.valueKind !== "number") {
    invalid("reduced vector projection requires a numeric parameter.");
  }
  if (projection.kind === "bin" && projection.index >= length) {
    invalid("analysis bin is outside the registered dimensions.");
  }
  if (projection.kind === "band" && projection.end > length) {
    invalid("analysis band is outside the registered dimensions.");
  }
};
var canonicalTransform = (input, path, fullVector) => {
  const value = record(input, path);
  keys(value, [
    "inputMin",
    "inputMax",
    "outputMin",
    "outputMax",
    "clamp",
    "invert",
    "attackSeconds",
    "releaseSeconds"
  ], [], path);
  const result = {
    inputMin: finite(value.inputMin, `${path}.inputMin`),
    inputMax: finite(value.inputMax, `${path}.inputMax`),
    outputMin: finite(value.outputMin, `${path}.outputMin`),
    outputMax: finite(value.outputMax, `${path}.outputMax`),
    clamp: value.clamp,
    invert: value.invert,
    attackSeconds: finite(value.attackSeconds, `${path}.attackSeconds`),
    releaseSeconds: finite(value.releaseSeconds, `${path}.releaseSeconds`)
  };
  if (typeof result.clamp !== "boolean" || typeof result.invert !== "boolean") {
    invalid(`${path}.clamp and invert must be boolean.`);
  }
  if (result.inputMax <= result.inputMin) invalid(`${path} input range is collapsed.`);
  if (result.attackSeconds < 0 || result.releaseSeconds < 0) {
    invalid(`${path} smoothing must be non-negative.`);
  }
  if (fullVector && (result.attackSeconds !== 0 || result.releaseSeconds !== 0)) {
    invalid(`${path} cannot smooth full vectors.`);
  }
  return result;
};
var canonicalBinding = (input, parameter3, editorProject, path) => {
  const value = record(input, path);
  keys(value, ["parameterId", "source"], ["transform"], path);
  if (text(value.parameterId, `${path}.parameterId`) !== parameter3.id) {
    invalid(`${path}.parameterId does not match the registry order.`);
  }
  const sourceValue = record(value.source, `${path}.source`);
  if (typeof sourceValue.kind !== "string" || !parameter3.allowedSourceKinds.includes(
    sourceValue.kind
  )) {
    invalid(`${path}.source.kind is not allowed for ${parameter3.id}.`);
  }
  let source;
  if (sourceValue.kind === "constant") {
    keys(sourceValue, ["kind", "value"], [], `${path}.source`);
    source = {
      kind: "constant",
      value: canonicalConstant(sourceValue.value, parameter3, `${path}.source.value`)
    };
  } else if (sourceValue.kind === "analysis") {
    if (!["number", "vector"].includes(parameter3.valueKind)) {
      invalid(`${path} parameter cannot use analysis data.`);
    }
    keys(sourceValue, ["kind", "featureId", "projection"], ["component"], `${path}.source`);
    const rawFeatureId = sourceValue.featureId;
    if (!isFeatureId(rawFeatureId)) invalid(`${path}.source.featureId is invalid.`);
    const featureId = rawFeatureId;
    const component = sourceValue.component === void 0 ? "default" : sourceValue.component;
    if (typeof component !== "string" || !COMPONENTS.has(component)) {
      invalid(`${path}.source.component is invalid.`);
    }
    const projection = canonicalProjection(sourceValue.projection, `${path}.source.projection`);
    if (!parameter3.allowedAnalysisComponents?.includes(
      component
    )) {
      invalid(`${path}.source.component is not allowed for ${parameter3.id}.`);
    }
    if (!parameter3.allowedAnalysisProjections?.includes(projection.kind)) {
      invalid(`${path}.source.projection is not allowed for ${parameter3.id}.`);
    }
    assertProjectionCompatible(
      featureId,
      component,
      projection,
      parameter3
    );
    source = {
      kind: "analysis",
      featureId,
      ...sourceValue.component === void 0 ? {} : { component },
      projection
    };
  } else if (sourceValue.kind === "editor-event") {
    if (parameter3.valueKind !== "number") {
      invalid(`${path} parameter cannot use Editor events.`);
    }
    keys(sourceValue, ["kind", "laneId"], ["innerClassId"], `${path}.source`);
    const laneId = text(sourceValue.laneId, `${path}.source.laneId`);
    const lane = editorProject?.lanes.find((entry) => entry.id === laneId);
    if (!lane) return invalid(`${path}.source.laneId is not present in the Editor snapshot.`);
    let innerClassId;
    if (sourceValue.innerClassId !== void 0) {
      innerClassId = text(sourceValue.innerClassId, `${path}.source.innerClassId`);
      if (!lane.innerClasses.some((entry) => entry.id === innerClassId)) {
        invalid(`${path}.source.innerClassId is not present in the lane.`);
      }
    }
    source = { kind: "editor-event", laneId, ...innerClassId ? { innerClassId } : {} };
  } else {
    return invalid(`${path}.source.kind is invalid.`);
  }
  const transform = value.transform === void 0 ? void 0 : canonicalTransform(
    value.transform,
    `${path}.transform`,
    source.kind === "analysis" && source.projection.kind === "full"
  );
  if (transform && parameter3.valueKind !== "number" && !(source.kind === "analysis" && source.projection.kind === "full")) {
    invalid(`${path}.transform is only valid for numeric bindings.`);
  }
  const outputRange = parameter3.valueKind === "number" ? parameter3.range : parameter3.vectorElementRange;
  if (transform && outputRange) {
    assertInRange(transform.outputMin, outputRange, `${path}.transform.outputMin`);
    assertInRange(transform.outputMax, outputRange, `${path}.transform.outputMax`);
  }
  return { parameterId: parameter3.id, source, ...transform ? { transform } : {} };
};

// src/processing/sha256.ts
var K = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var r = (x, n) => x >>> n | x << 32 - n;
var Sha256 = class {
  h = new Uint32Array([1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225]);
  block = new Uint8Array(64);
  words = new Uint32Array(64);
  used = 0;
  bytes = 0;
  finished = false;
  update(input) {
    if (this.finished) throw new Error("Hash already finalized.");
    this.bytes += input.length;
    for (let start = 0; start < input.length; ) {
      const count = Math.min(64 - this.used, input.length - start);
      this.block.set(input.subarray(start, start + count), this.used);
      this.used += count;
      start += count;
      if (this.used === 64) {
        this.compress();
        this.used = 0;
      }
    }
    return this;
  }
  compress() {
    const w = this.words, view = new DataView(this.block.buffer);
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(i * 4, false);
    for (let i = 16; i < 64; i++) {
      const a2 = w[i - 15], b2 = w[i - 2];
      w[i] = w[i - 16] + (r(a2, 7) ^ r(a2, 18) ^ a2 >>> 3) + w[i - 7] + (r(b2, 17) ^ r(b2, 19) ^ b2 >>> 10);
    }
    let [a, b, c, d, e, f, g, h] = Array.from(this.h);
    for (let i = 0; i < 64; i++) {
      const t1 = h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + (e & f ^ ~e & g) + K[i] + w[i] >>> 0;
      const t2 = (r(a, 2) ^ r(a, 13) ^ r(a, 22)) + (a & b ^ a & c ^ b & c) >>> 0;
      h = g;
      g = f;
      f = e;
      e = d + t1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = t1 + t2 >>> 0;
    }
    [a, b, c, d, e, f, g, h].forEach((v, i) => {
      this.h[i] = this.h[i] + v;
    });
  }
  hex() {
    if (this.finished) throw new Error("Hash already finalized.");
    const bits = this.bytes * 8;
    this.block[this.used++] = 128;
    if (this.used > 56) {
      this.block.fill(0, this.used);
      this.compress();
      this.used = 0;
    }
    this.block.fill(0, this.used, 56);
    const view = new DataView(this.block.buffer);
    view.setUint32(56, Math.floor(bits / 4294967296), false);
    view.setUint32(60, bits >>> 0, false);
    this.compress();
    this.finished = true;
    return Array.from(this.h, (v) => v.toString(16).padStart(8, "0")).join("");
  }
};
var hashBytes = (input) => new Sha256().update(input).hex();

// src/visualizer/resourceIdentity.ts
function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const object = value;
  return "{" + Object.keys(object).sort().map((key) => JSON.stringify(key) + ":" + canonicalJson(object[key])).join(",") + "}";
}
function resourceHash(value) {
  const { hash: _hash, ...payload } = value;
  return hashBytes(new TextEncoder().encode(canonicalJson(payload)));
}
var resourceRef = ({ id, version: version2, hash }) => ({ id, version: version2, hash });
var resourceKey = (ref) => `${ref.id}@${ref.version}:${ref.hash}`;
var sameResource = (a, b) => resourceKey(a) === resourceKey(b);

// src/visualizer/editorMarkerValidation.ts
function validateMarkerInputs(input) {
  if (!Array.isArray(input) || !input.length) return invalid("\u6807\u8BB0\u8F93\u5165\u58F0\u660E\u5FC5\u987B\u4E3A\u975E\u7A7A\u5217\u8868\u3002");
  const ids = /* @__PURE__ */ new Set();
  return input.map((raw) => {
    const v = record(raw, "\u6807\u8BB0\u8F93\u5165");
    keys(v, ["id", "eventKind", "selectionModes"]);
    const id = text(v.id, "\u6807\u8BB0\u8F93\u5165 ID");
    if (!/^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(id) || ["__proto__", "prototype", "constructor"].includes(id) || ids.has(id))
      return invalid("\u6807\u8BB0\u8F93\u5165 ID \u65E0\u6548\u6216\u91CD\u590D\u3002");
    ids.add(id);
    if (!["point", "range"].includes(String(v.eventKind)) || !Array.isArray(v.selectionModes) || !v.selectionModes.length || new Set(v.selectionModes).size !== v.selectionModes.length || v.selectionModes.some((m) => !["single", "collection"].includes(m)))
      return invalid("\u6807\u8BB0\u8F93\u5165\u7C7B\u578B\u6216\u9009\u62E9\u6A21\u5F0F\u65E0\u6548\u3002");
    return { id, eventKind: v.eventKind, selectionModes: [...v.selectionModes] };
  });
}
function validateMarkerDefinitions(input, contracts) {
  if (!contracts) {
    if (input !== void 0) invalid("\u7B97\u6CD5\u672A\u58F0\u660E\u6807\u8BB0\u8F93\u5165\u3002");
    return void 0;
  }
  if (!Array.isArray(input) || input.length !== contracts.length) return invalid("\u5143\u7D20\u6807\u8BB0\u8F93\u5165\u5B9A\u4E49\u4E0D\u5B8C\u6574\u3002");
  return contracts.map((contract, index) => {
    const v = record(input[index], "\u5143\u7D20\u6807\u8BB0\u8F93\u5165");
    keys(v, ["id", "eventKind", "selectionModes", "label"]);
    const entry = validateMarkerInputs([
      { id: v.id, eventKind: v.eventKind, selectionModes: v.selectionModes }
    ])[0];
    if (entry.id !== contract.id || entry.eventKind !== contract.eventKind || entry.selectionModes.some((m) => !contract.selectionModes.includes(m)))
      return invalid("\u5143\u7D20\u6807\u8BB0\u8F93\u5165\u8D85\u51FA\u7B97\u6CD5\u58F0\u660E\u3002");
    return { ...entry, label: text(v.label, "\u6807\u8BB0\u8F93\u5165\u6807\u7B7E") };
  });
}
function defaultMarkerBindings(inputs, timingInput) {
  const selected = inputs?.filter((i) => i.id !== timingInput) ?? [];
  return selected.length ? Object.fromEntries(selected.map((i) => [i.id, { kind: "unbound" }])) : void 0;
}
function validateMarkerBindings(input, inputs, timingInput, editor, packageOnly = false) {
  const selected = inputs?.filter((i) => i.id !== timingInput) ?? [];
  if (!selected.length) {
    if (input !== void 0) invalid("\u6B64\u5143\u7D20\u4E0D\u63A5\u53D7\u72EC\u7ACB\u6807\u8BB0\u7ED1\u5B9A\u3002");
    return void 0;
  }
  const value = record(input, "\u6807\u8BB0\u7ED1\u5B9A");
  keys(
    value,
    selected.map((i) => i.id)
  );
  return Object.fromEntries(
    selected.map((descriptor) => {
      const v = record(value[descriptor.id], "\u6807\u8BB0\u7ED1\u5B9A");
      if (v.kind === "unbound") {
        keys(v, ["kind"]);
        return [descriptor.id, { kind: "unbound" }];
      }
      if (packageOnly) return invalid("\u8D44\u6E90\u5305\u4E0D\u80FD\u4FDD\u5B58\u5B9E\u9645\u5DE5\u7A0B\u7684\u6807\u8BB0\u5F15\u7528\u3002");
      if (!descriptor.selectionModes.includes(v.kind))
        return invalid("\u6807\u8BB0\u9009\u62E9\u6A21\u5F0F\u4E0D\u53D7\u652F\u6301\u3002");
      const laneId = text(v.laneId, "\u6807\u8BB0\u8F68\u9053"), lane = editor?.lanes.find((l) => l.id === laneId);
      if (!lane || lane.eventKind !== descriptor.eventKind)
        return invalid("\u6807\u8BB0\u8F68\u9053\u7F3A\u5931\u6216\u7C7B\u578B\u4E0D\u5339\u914D\uFF1A" + descriptor.label);
      if (v.kind === "single") {
        keys(v, ["kind", "laneId", "eventId"]);
        const eventId = text(v.eventId, "\u6807\u8BB0 ID");
        if (!lane.events.some((e) => e.id === eventId)) return invalid("\u6240\u9009\u6807\u8BB0\u5DF2\u5931\u6548\uFF1A" + descriptor.label);
        return [descriptor.id, { kind: "single", laneId, eventId }];
      }
      keys(v, ["kind", "laneId"], ["innerClassIds"]);
      if (v.innerClassIds !== void 0 && (!Array.isArray(v.innerClassIds) || !v.innerClassIds.length || new Set(v.innerClassIds).size !== v.innerClassIds.length || v.innerClassIds.some((id) => !lane.innerClasses.some((c) => c.id === id))))
        return invalid("\u6240\u9009\u6807\u8BB0\u5206\u7C7B\u5DF2\u5931\u6548\uFF1A" + descriptor.label);
      return [
        descriptor.id,
        {
          kind: "collection",
          laneId,
          ...v.innerClassIds !== void 0 ? { innerClassIds: [...v.innerClassIds] } : {}
        }
      ];
    })
  );
}

// src/visualizer/algorithmCodec.ts
var identifier = (value) => {
  const id = text(value, "\u7B97\u6CD5\u6807\u8BC6");
  if (!/^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(id) || ["__proto__", "prototype", "constructor"].includes(id))
    invalid("\u7B97\u6CD5\u6807\u8BC6\u65E0\u6548\u3002");
  return id;
};
var list = (value, allowed) => {
  if (!Array.isArray(value) || new Set(value).size !== value.length) return invalid("\u7B97\u6CD5\u80FD\u529B\u5217\u8868\u65E0\u6548\u3002");
  return value.map((v) => {
    const id = identifier(v);
    if (allowed && !allowed.includes(id)) invalid("\u7B97\u6CD5\u58F0\u660E\u4E86\u4E0D\u652F\u6301\u7684\u80FD\u529B\u3002");
    return id;
  });
};
function range(input) {
  const v = record(input, "\u7B97\u6CD5\u53C2\u6570\u8303\u56F4");
  keys(v, ["min", "max"], ["integer", "editingPrecision"]);
  if (finite(v.min, "min") > finite(v.max, "max")) invalid("\u7B97\u6CD5\u53C2\u6570\u8303\u56F4\u65E0\u6548\u3002");
  if (v.integer !== void 0 && typeof v.integer !== "boolean") invalid("\u7B97\u6CD5\u6574\u6570\u58F0\u660E\u65E0\u6548\u3002");
  if (v.editingPrecision !== void 0 && (!Number.isInteger(v.editingPrecision) || Number(v.editingPrecision) < 0 || Number(v.editingPrecision) > 100))
    invalid("\u7B97\u6CD5\u7F16\u8F91\u7CBE\u5EA6\u65E0\u6548\u3002");
}
function parameter(input) {
  const v = record(input, "\u7B97\u6CD5\u53C2\u6570");
  keys(
    v,
    ["id", "valueKind", "allowedSourceKinds"],
    ["range", "vectorElementRange", "allowEmptyVector", "allowedAnalysisComponents", "allowedAnalysisProjections"]
  );
  identifier(v.id);
  if (!["number", "boolean", "color", "vector"].includes(String(v.valueKind))) invalid("\u7B97\u6CD5\u53C2\u6570\u7C7B\u578B\u65E0\u6548\u3002");
  if (!list(v.allowedSourceKinds, ["constant", "analysis", "native"]).length) invalid("\u7B97\u6CD5\u7F3A\u5C11\u8F93\u5165\u80FD\u529B\u3002");
  if (v.range !== void 0) {
    if (v.valueKind !== "number") invalid("\u4EC5\u6570\u503C\u53C2\u6570\u652F\u6301\u8303\u56F4\u3002");
    range(v.range);
  }
  if (v.vectorElementRange !== void 0) {
    if (v.valueKind !== "vector") invalid("\u4EC5\u5411\u91CF\u652F\u6301\u5206\u91CF\u8303\u56F4\u3002");
    range(v.vectorElementRange);
  }
  if (v.allowEmptyVector !== void 0 && (v.valueKind !== "vector" || typeof v.allowEmptyVector !== "boolean"))
    invalid("\u7B97\u6CD5\u5411\u91CF\u58F0\u660E\u65E0\u6548\u3002");
  if (v.allowedAnalysisComponents !== void 0)
    list(v.allowedAnalysisComponents, ["default", "total", "specific", "real", "imag", "magnitude", "phase"]);
  if (v.allowedAnalysisProjections !== void 0)
    list(v.allowedAnalysisProjections, ["scalar", "mean", "max", "peak", "bin", "band", "full"]);
  return structuredClone(v);
}
function validateAlgorithmContract(input, apiVersion = 1) {
  const v = record(input, "\u7B97\u6CD5\u5951\u7EA6");
  keys(
    v,
    ["kind", "parameters", "sharedParameters", "historyParameters"],
    apiVersion === 2 ? ["inputParameter", "markerInputs", "timingInput"] : ["inputParameter"]
  );
  if (!["visual", "modifier", "transition"].includes(String(v.kind)) || !Array.isArray(v.parameters))
    return invalid("\u7B97\u6CD5\u79CD\u7C7B\u6216\u53C2\u6570\u65E0\u6548\u3002");
  const parameters = v.parameters.map(parameter), ids = parameters.map((p) => p.id);
  if (new Set(ids).size !== ids.length) invalid("\u7B97\u6CD5\u53C2\u6570\u91CD\u590D\u3002");
  if (v.inputParameter !== void 0 && !ids.includes(identifier(v.inputParameter))) invalid("\u7B97\u6CD5\u8F93\u5165\u53C2\u6570\u4E0D\u5B58\u5728\u3002");
  const sharedParameters = list(v.sharedParameters, ids), historyParameters = list(v.historyParameters, ids);
  if (sharedParameters.some((id) => parameters.find((p) => p.id === id)?.valueKind !== "number"))
    invalid("\u5171\u540C\u5904\u7406\u53C2\u6570\u5FC5\u987B\u4E3A\u6570\u503C\u3002");
  const markerInputs = apiVersion === 2 ? validateMarkerInputs(v.markerInputs) : void 0;
  let timingInput;
  if (v.timingInput !== void 0) {
    timingInput = identifier(v.timingInput);
    const marker = markerInputs?.find((i) => i.id === timingInput);
    if (v.kind !== "transition" || !marker || marker.eventKind !== "range" || marker.selectionModes.length !== 1 || marker.selectionModes[0] !== "single")
      invalid("\u8F6C\u573A\u65F6\u95F4\u8F93\u5165\u5FC5\u987B\u58F0\u660E\u5355\u4E2A\u8303\u56F4\u3002");
  }
  return {
    kind: v.kind,
    parameters,
    sharedParameters,
    historyParameters,
    ...v.inputParameter !== void 0 ? { inputParameter: String(v.inputParameter) } : {},
    ...markerInputs ? { markerInputs } : {},
    ...timingInput ? { timingInput } : {}
  };
}
function validateShaderProgram(input) {
  const v = record(input, "Shader");
  keys(v, ["vertex", "fragment", "geometry", "uniforms"]);
  text(v.vertex, "vertex");
  text(v.fragment, "fragment");
  if (!["quad", "triangles"].includes(String(v.geometry))) invalid("Shader \u51E0\u4F55\u7C7B\u578B\u65E0\u6548\u3002");
  const uniforms = record(v.uniforms, "uniforms");
  for (const [name2, raw] of Object.entries(uniforms)) {
    identifier(name2);
    const u = record(raw, "uniform");
    keys(u, ["type"], ["length"]);
    if (!["number", "int", "boolean", "color", "vec2", "vec3", "array", "source"].includes(String(u.type)))
      invalid("uniform \u7C7B\u578B\u65E0\u6548\u3002");
    if (u.type === "array") {
      const length = integer(u.length, "uniform length");
      if (length < 1 || length > 65536) invalid("uniform \u6570\u7EC4\u957F\u5EA6\u65E0\u6548\u3002");
    } else if (u.length !== void 0) invalid("\u4EC5\u6570\u7EC4 uniform \u652F\u6301\u957F\u5EA6\u3002");
  }
  return structuredClone(v);
}
function validateAlgorithmDefinition(input) {
  const v = record(input, "\u7B97\u6CD5\u5B9A\u4E49");
  keys(v, ["id", "version", "hash", "apiVersion", "contract", "source", "programs"]);
  const id = text(v.id, "\u7B97\u6CD5 ID"), version2 = integer(v.version, "\u7B97\u6CD5\u7248\u672C");
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(id) || version2 < 1 || !Number.isSafeInteger(version2)) invalid("\u7B97\u6CD5\u8EAB\u4EFD\u65E0\u6548\u3002");
  if (v.apiVersion !== 1 && v.apiVersion !== 2) invalid("\u7B97\u6CD5 ABI \u4E0D\u53D7\u652F\u6301\u3002");
  if (typeof v.hash !== "string" || !/^[a-f0-9]{64}$/.test(v.hash) || resourceHash(v) !== v.hash)
    invalid("\u7B97\u6CD5\u5185\u5BB9\u4E0E SHA-256 \u4E0D\u5339\u914D\u3002");
  const contract = validateAlgorithmContract(v.contract, v.apiVersion), programs = {};
  for (const [name2, program] of Object.entries(record(v.programs, "programs")))
    Object.defineProperty(programs, identifier(name2), { value: validateShaderProgram(program), enumerable: true });
  if (!Object.keys(programs).length) invalid("\u7B97\u6CD5\u7F3A\u5C11 Shader\u3002");
  return {
    id,
    version: version2,
    hash: String(v.hash),
    apiVersion: v.apiVersion,
    contract,
    source: text(v.source, "\u7B97\u6CD5\u6E90\u7801"),
    programs
  };
}

// src/visualizer/elementBindings.ts
function validateElementBinding(input, p) {
  const b = record(input, "binding"), source = record(b.source, "source");
  if (source.kind === "unbound") {
    keys(b, ["parameterId", "source"]);
    keys(source, ["kind"]);
    if (b.parameterId !== p.id || !p.allowedSourceKinds.includes("analysis"))
      return invalid("\u6B64\u53C2\u6570\u4E0D\u80FD\u5904\u4E8E\u672A\u7ED1\u5B9A\u72B6\u6001\u3002");
    return { parameterId: p.id, source: { kind: "unbound" } };
  }
  if (source.kind === "native") {
    keys(b, ["parameterId", "source"]);
    keys(source, ["kind", "featureId"]);
    if (b.parameterId !== p.id || p.valueKind !== "vector" || !p.allowedSourceKinds.includes("native") || source.featureId !== "frequency" && source.featureId !== "waveform")
      return invalid("\u539F\u751F\u8F93\u5165\u7279\u5F81\u6216\u53C2\u6570\u65E0\u6548\u3002");
    return {
      parameterId: p.id,
      source: { kind: "native", featureId: source.featureId }
    };
  }
  if (source.kind !== "constant" && source.kind !== "analysis")
    return invalid("\u53EA\u652F\u6301\u56FA\u5B9A\u503C\u3001\u539F\u66F2 Analyzer \u6216\u539F\u751F\u8F93\u5165\u3002");
  return canonicalBinding(b, p, void 0, "binding");
}
function validateElementBindings(input, parameters) {
  if (!Array.isArray(input) || input.length !== parameters.length) return invalid("\u5143\u7D20\u53C2\u6570\u4E0D\u5B8C\u6574\u3002");
  return parameters.map((parameter3, index) => validateElementBinding(input[index], parameter3));
}

// src/visualizer/elementRegistry.ts
function findResource(entries, id) {
  const found = typeof id === "string" ? entries.find((e) => resourceKey(e) === id) ?? entries.filter((e) => e.id === id).sort((a, b) => b.version - a.version)[0] : entries.find((e) => sameResource(e, id));
  if (!found) throw Error("\u8D44\u6E90\u4E0D\u5B58\u5728\u6216\u7248\u672C\u7F3A\u5931\uFF1A" + (typeof id === "string" ? id : resourceKey(id)));
  return found;
}
function createDefinitionElement(d, durationSeconds, layer, timingInput) {
  const markerBindings = defaultMarkerBindings(d.markerInputs, timingInput);
  return {
    id: crypto.randomUUID(),
    resource: resourceRef(d),
    name: d.title,
    enabled: true,
    layer,
    timing: d.kind === "transition" ? { kind: "unbound" } : { kind: "manual", startSeconds: 0, endSeconds: durationSeconds },
    bindings: d.parameters.map((p) => ({
      parameterId: p.id,
      ...p.defaultBinding ? structuredClone(p.defaultBinding) : { source: { kind: "constant", value: structuredClone(p.defaultValue) } }
    })),
    ...markerBindings ? { markerBindings } : {},
    ...d.kind === "visual" ? {} : { targets: { kind: "composition" } }
  };
}
var ElementRegistry = class {
  definitions = [];
  presets = [];
  algorithms = [];
  replace(snapshot) {
    this.algorithms.splice(0, this.algorithms.length, ...structuredClone(snapshot.algorithms));
    this.definitions.splice(0, this.definitions.length, ...structuredClone(snapshot.elements));
    this.presets.splice(0, this.presets.length, ...structuredClone(snapshot.presets));
  }
  list() {
    return this.definitions;
  }
  get(id) {
    return findResource(this.definitions, id);
  }
  create(id, duration, layer) {
    const definition = this.get(id), algorithm = findResource(this.algorithms, definition.algorithm);
    return createDefinitionElement(definition, duration, layer, algorithm.contract.timingInput);
  }
};
var elementRegistry = new ElementRegistry();

// src/visualizer/bindingDefaults.ts
var analysisComponentsForFeature = (featureId) => {
  const shape = FEATURE_REGISTRY[featureId].outputShape;
  if (shape === "loudness-structure") return ["total", "specific"];
  if (shape === "complex-spectrum") {
    return ["real", "imag", "magnitude", "phase"];
  }
  return ["default"];
};
var analysisComponentIsVector = (featureId, component) => {
  const shape = FEATURE_REGISTRY[featureId].outputShape;
  if (shape === "scalar") return false;
  if (shape === "loudness-structure") return component === "specific";
  return true;
};
var compatibleAnalysisFeatures = (parameter3) => FEATURE_IDS.filter((featureId) => {
  const components = analysisComponentsForFeature(featureId);
  return components.some((component) => {
    if (!parameter3.allowedAnalysisComponents?.includes(component)) return false;
    const vector = analysisComponentIsVector(featureId, component);
    if (parameter3.valueKind === "vector") {
      return vector && (parameter3.allowedAnalysisProjections?.includes("full") ?? false);
    }
    if (parameter3.valueKind !== "number") return false;
    return parameter3.allowedAnalysisProjections?.some((kind) => vector ? kind !== "scalar" && kind !== "full" : kind === "scalar") ?? false;
  });
});
var compatibleAnalysisProjections = (parameter3, featureId, component) => {
  const vector = analysisComponentIsVector(featureId, component);
  return (parameter3.allowedAnalysisProjections ?? []).filter((kind) => {
    if (parameter3.valueKind === "vector") return vector && kind === "full";
    if (parameter3.valueKind !== "number") return false;
    return vector ? kind !== "scalar" && kind !== "full" : kind === "scalar";
  });
};
var createProjection = (kind) => {
  if (kind === "bin") return { kind, index: 0 };
  if (kind === "band") return { kind, start: 0, end: 1 };
  return { kind };
};
var defaultAnalysisSelection = (parameter3, featureId) => {
  const components = analysisComponentsForFeature(featureId).filter(
    (component2) => parameter3.allowedAnalysisComponents?.includes(component2)
  );
  const component = components.find((entry) => parameter3.valueKind === "vector" ? analysisComponentIsVector(featureId, entry) : !analysisComponentIsVector(featureId, entry)) ?? components[0];
  if (!component) throw new Error("\u8BE5\u7279\u5F81\u6CA1\u6709\u517C\u5BB9\u7684\u5206\u6790\u5206\u91CF\u3002");
  const projections = compatibleAnalysisProjections(
    parameter3,
    featureId,
    component
  );
  const preferred = projections.includes("mean") ? "mean" : projections[0];
  if (!preferred) throw new Error("\u8BE5\u53C2\u6570\u6CA1\u6709\u517C\u5BB9\u7684\u5206\u6790\u6295\u5F71\u3002");
  return { component, projection: createProjection(preferred) };
};
var defaultNumericTransform = (parameter3, featureId) => {
  if (parameter3.valueKind !== "number" || !parameter3.range) {
    throw new Error("\u53EA\u6709\u6570\u503C\u53C2\u6570\u53EF\u4EE5\u5EFA\u7ACB\u6570\u503C\u6620\u5C04\u3002");
  }
  const featureRange = featureId ? FEATURE_REGISTRY[featureId].range : void 0;
  const finiteRegistryRange = Number.isFinite(featureRange?.min) && Number.isFinite(featureRange?.max) && (featureRange?.max ?? 0) > (featureRange?.min ?? 0);
  return {
    inputMin: finiteRegistryRange ? featureRange.min : 0,
    inputMax: finiteRegistryRange ? featureRange.max : 1,
    outputMin: typeof parameter3.defaultValue === "number" ? parameter3.defaultValue : parameter3.range.min,
    outputMax: parameter3.range.max,
    clamp: true,
    invert: false,
    attackSeconds: 0,
    releaseSeconds: 0
  };
};
var createDefaultAnalysisBinding = (parameter3, featureId) => {
  const selection = defaultAnalysisSelection(parameter3, featureId);
  return {
    parameterId: parameter3.id,
    source: {
      kind: "analysis",
      featureId,
      ...selection.component === "default" ? {} : { component: selection.component },
      projection: selection.projection
    },
    ...parameter3.valueKind === "number" ? { transform: defaultNumericTransform(parameter3, featureId) } : {}
  };
};

// src/visualizer/commonControls.ts
var transformFields = [
  "inputMin",
  "inputMax",
  "outputMin",
  "outputMax",
  "clamp",
  "invert",
  "attackSeconds",
  "releaseSeconds"
];
function controlBinding(control, binding, value, definition, algorithms) {
  const parameter3 = definition.parameters.find((p) => p.id === control.parameterId);
  if (!parameter3) return invalid("\u5171\u540C\u53C2\u6570\u4E0D\u5B58\u5728\u3002");
  const kernel = findResource(algorithms, definition.algorithm).contract;
  let candidate;
  if (control.kind === "value") {
    if (!kernel.sharedParameters.includes(parameter3.id) || parameter3.valueKind !== "number")
      return invalid("\u6837\u5F0F\u53C2\u6570\u4E0D\u80FD\u4F5C\u4E3A\u9884\u8BBE\u5171\u540C\u53C2\u6570\u3002");
    candidate = { parameterId: parameter3.id, source: { kind: "constant", value } };
  } else if (control.kind === "binding") {
    if (kernel.inputParameter !== parameter3.id) return invalid("\u5171\u540C\u8F93\u5165\u5FC5\u987B\u662F\u5185\u6838\u58F0\u660E\u7684\u6570\u636E\u8F93\u5165\u3002");
    const v = record(value, "\u5171\u540C\u8F93\u5165");
    keys(v, ["source"], ["transform"]);
    candidate = { parameterId: parameter3.id, ...v };
  } else {
    if (kernel.inputParameter !== parameter3.id || parameter3.valueKind !== "number" || binding.source.kind !== "analysis" || !control.field || !transformFields.includes(control.field))
      return invalid("\u5171\u540C\u6620\u5C04\u5B57\u6BB5\u4E0D\u53EF\u7528\u3002");
    candidate = {
      ...binding,
      transform: {
        ...binding.transform ?? defaultNumericTransform(parameter3, binding.source.featureId),
        [control.field]: value
      }
    };
  }
  return validateElementBinding(candidate, parameter3);
}
function commonValue(control, binding, definition) {
  if (control.kind === "value") return binding.source.kind === "constant" ? binding.source.value : null;
  if (control.kind === "binding") {
    const { parameterId: _parameterId, ...value } = binding;
    return value;
  }
  const parameter3 = definition.parameters.find((p) => p.id === binding.parameterId);
  return binding.source.kind === "analysis" ? (binding.transform ?? defaultNumericTransform(parameter3, binding.source.featureId))[control.field] : null;
}
function validateCommonControls(input, targets, algorithms) {
  if (!Array.isArray(input)) return invalid("\u5171\u540C\u53C2\u6570\u5FC5\u987B\u4E3A\u5217\u8868\u3002");
  const ids = /* @__PURE__ */ new Set(), owned = /* @__PURE__ */ new Set();
  return input.map((entry) => {
    const c = record(entry, "\u5171\u540C\u53C2\u6570");
    keys(c, ["id", "label", "kind", "parameterId", "targets", "value"], ["field"]);
    if (!["value", "binding", "transform"].includes(String(c.kind))) return invalid("\u5171\u540C\u53C2\u6570\u7C7B\u578B\u65E0\u6548\u3002");
    const id = text(c.id, "\u5171\u540C\u53C2\u6570 ID");
    if (ids.has(id)) return invalid("\u5171\u540C\u53C2\u6570 ID \u91CD\u590D\u3002");
    ids.add(id);
    if (!Array.isArray(c.targets) || !c.targets.length || c.targets.some((t) => typeof t !== "string") || new Set(c.targets).size !== c.targets.length)
      return invalid("\u5171\u540C\u53C2\u6570\u76EE\u6807\u65E0\u6548\u3002");
    if (c.kind === "transform" ? !transformFields.includes(c.field) : c.field !== void 0)
      return invalid("\u5171\u540C\u53C2\u6570\u5B57\u6BB5\u65E0\u6548\u3002");
    const control = {
      id,
      label: text(c.label, "\u5171\u540C\u53C2\u6570\u540D\u79F0"),
      kind: c.kind,
      parameterId: text(c.parameterId, "parameterId"),
      targets: [...c.targets],
      value: structuredClone(c.value),
      ...c.field ? { field: c.field } : {}
    };
    for (const target of control.targets) {
      const t = targets.get(target), binding = t?.bindings.find((b) => b.parameterId === control.parameterId);
      if (!t || !binding) return invalid("\u5171\u540C\u53C2\u6570\u5F15\u7528\u4E86\u4E0D\u5B58\u5728\u7684\u5B50\u5143\u7D20\u6216\u53C2\u6570\u3002");
      const bindingKey = target + ":" + control.parameterId;
      const key = bindingKey + ":" + (control.kind === "transform" ? control.field : "*");
      if (owned.has(key) || owned.has(bindingKey + ":*") || control.kind !== "transform" && [...owned].some((key2) => key2.startsWith(bindingKey + ":")))
        return invalid("\u5171\u540C\u53C2\u6570\u4E0D\u80FD\u91CD\u53E0\u63A7\u5236\u540C\u4E00\u5B57\u6BB5\u3002");
      owned.add(key);
      const parameter3 = t.definition.parameters.find((p) => p.id === control.parameterId);
      const probe = control.kind === "transform" && binding.source.kind !== "analysis" ? createDefaultAnalysisBinding(
        parameter3,
        compatibleAnalysisFeatures(parameter3)[0]
      ) : binding;
      controlBinding(control, probe, control.value, t.definition, algorithms);
    }
    return control;
  });
}

// src/utils/numberEditing.ts
var roundEditingValue = (value, precision) => Number(value.toFixed(precision));

// src/visualizer/resourceCodec.ts
var icons = [
  "square",
  "strings",
  "dots",
  "rings",
  "radial",
  "orbit",
  "wireform",
  "arcs",
  "tunnel",
  "stars",
  "scale",
  "blur",
  "fade"
];
var name = (input) => {
  const value = text(input, "\u8D44\u6E90 ID");
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(value)) return invalid("\u8D44\u6E90 ID \u683C\u5F0F\u65E0\u6548\u3002");
  return value;
};
var version = (input) => {
  const value = integer(input, "\u8D44\u6E90\u7248\u672C");
  if (value < 1 || !Number.isSafeInteger(value)) return invalid("\u8D44\u6E90\u7248\u672C\u65E0\u6548\u3002");
  return value;
};
function validateResourceRef(input) {
  const v = record(input, "\u8D44\u6E90\u5F15\u7528");
  keys(v, ["id", "version", "hash"]);
  if (typeof v.hash !== "string" || !/^[a-f0-9]{64}$/.test(v.hash)) return invalid("\u8D44\u6E90 SHA-256 \u65E0\u6548\u3002");
  return { id: name(v.id), version: version(v.version), hash: v.hash };
}
function identity(v) {
  const ref = validateResourceRef({ id: v.id, version: v.version, hash: v.hash });
  if (resourceHash(v) !== ref.hash) return invalid("\u8D44\u6E90\u5185\u5BB9\u4E0E SHA-256 \u4E0D\u5339\u914D\u3002");
  return ref;
}
function assertDefaultPrecision(value, parameter3) {
  if (parameter3.valueKind === "number" && typeof value === "number" && roundEditingValue(value, parameter3.range?.editingPrecision ?? (parameter3.range?.integer ? 0 : 2)) !== value)
    return invalid("\u8D44\u6E90\u9ED8\u8BA4\u5E38\u91CF\u987B\u9075\u5B88\u58F0\u660E\u7684\u7F16\u8F91\u7CBE\u5EA6\u3002");
}
function parameter2(input, contract) {
  const v = record(input, "\u53C2\u6570\u5B9A\u4E49");
  keys(
    v,
    ["id", "label", "valueKind", "defaultValue", "allowedSourceKinds"],
    [
      "range",
      "vectorElementRange",
      "allowEmptyVector",
      "allowedAnalysisComponents",
      "allowedAnalysisProjections",
      "defaultBinding"
    ]
  );
  if (v.id !== contract.id || v.valueKind !== contract.valueKind) return invalid("\u53C2\u6570\u4E0E\u7ED8\u5236\u5185\u6838\u4E0D\u5339\u914D\u3002");
  text(v.label, "\u53C2\u6570\u6807\u7B7E");
  for (const field of ["allowedSourceKinds", "allowedAnalysisComponents", "allowedAnalysisProjections"]) {
    const values = v[field], allowed = contract[field];
    if (values === void 0 && allowed === void 0) continue;
    if (!Array.isArray(values) || !values.length || !allowed || new Set(values).size !== values.length || values.some((value) => !allowed.includes(value)))
      return invalid("\u53C2\u6570\u58F0\u660E\u4E86\u5185\u6838\u4E0D\u652F\u6301\u7684\u8F93\u5165\u80FD\u529B\u3002");
  }
  for (const field of ["range", "vectorElementRange"]) {
    const permitted = contract[field];
    if (!permitted) {
      if (v[field] !== void 0) return invalid("\u5185\u6838\u672A\u58F0\u660E\u6B64\u53C2\u6570\u8303\u56F4\u3002");
      continue;
    }
    const range2 = record(v[field], field);
    keys(range2, ["min", "max"], ["integer", "editingPrecision"]);
    const min = finite(range2.min, "min"), max = finite(range2.max, "max");
    if (min < permitted.min || max > permitted.max || min > max || range2.integer !== permitted.integer)
      return invalid("\u53C2\u6570\u8303\u56F4\u8D85\u51FA\u5185\u6838\u7EA6\u675F\u3002");
    if (range2.editingPrecision !== void 0 && (!Number.isInteger(range2.editingPrecision) || Number(range2.editingPrecision) < 0 || Number(range2.editingPrecision) > 100))
      return invalid("\u53C2\u6570\u7F16\u8F91\u7CBE\u5EA6\u65E0\u6548\u3002");
  }
  if (v.allowEmptyVector !== contract.allowEmptyVector) return invalid("\u5411\u91CF\u7EA6\u675F\u4E0E\u5185\u6838\u4E0D\u7B26\u3002");
  const result = structuredClone(v);
  assertDefaultPrecision(result.defaultValue, result);
  validateElementBinding(
    { parameterId: result.id, source: { kind: "constant", value: result.defaultValue } },
    { ...result, allowedSourceKinds: ["constant"] }
  );
  if (v.defaultBinding !== void 0) {
    const binding = record(v.defaultBinding, "\u9ED8\u8BA4\u7ED1\u5B9A");
    keys(binding, ["source"], ["transform"]);
    const validated = validateElementBinding({ parameterId: result.id, ...binding }, result);
    if (validated.source.kind === "constant") assertDefaultPrecision(validated.source.value, result);
  }
  return result;
}
function elementDefinition(input, algorithms) {
  const v = record(input, "\u5143\u7D20\u5B9A\u4E49");
  keys(
    v,
    ["id", "version", "hash", "algorithm", "kind", "title", "icon", "parameters"],
    ["inputParameter", "markerInputs"]
  );
  const ref = identity(v);
  const algorithm = validateResourceRef(v.algorithm), definition = algorithms.find((a) => sameResource(a, algorithm));
  if (!definition) return invalid("\u7ED8\u5236\u7B97\u6CD5\u4F9D\u8D56\u7F3A\u5931\u3002");
  const kernel = definition.contract;
  if (v.kind !== kernel.kind || v.inputParameter !== kernel.inputParameter || !icons.includes(String(v.icon)))
    return invalid("\u5143\u7D20\u79CD\u7C7B\u3001\u8F93\u5165\u6216\u56FE\u6807\u65E0\u6548\u3002");
  if (!Array.isArray(v.parameters) || v.parameters.length !== kernel.parameters.length)
    return invalid("\u5143\u7D20\u53C2\u6570\u5B9A\u4E49\u4E0D\u5B8C\u6574\u3002");
  const markerInputs = validateMarkerDefinitions(v.markerInputs, kernel.markerInputs);
  return {
    ...ref,
    algorithm,
    kind: kernel.kind,
    title: text(v.title, "\u5143\u7D20\u540D\u79F0"),
    icon: String(v.icon),
    ...kernel.inputParameter ? { inputParameter: kernel.inputParameter } : {},
    parameters: kernel.parameters.map((p, i) => parameter2(v.parameters[i], p)),
    ...markerInputs ? { markerInputs } : {}
  };
}
function mergeResources(...snapshots) {
  const result = { algorithms: [], elements: [], presets: [] };
  for (const field of ["algorithms", "elements", "presets"]) {
    const entries = /* @__PURE__ */ new Map();
    for (const snapshot of snapshots)
      for (const definition of snapshot[field]) {
        const key = definition.id + "@" + definition.version, existing = entries.get(key);
        if (existing && !sameResource(existing, definition))
          return invalid("\u540C\u4E00\u8D44\u6E90 ID \u4E0E\u7248\u672C\u5BF9\u5E94\u4E86\u4E0D\u540C\u5185\u5BB9\u3002");
        entries.set(key, definition);
      }
    Object.assign(result, { [field]: [...entries.values()] });
  }
  return result;
}
function presetDefinition(input, elements, algorithms) {
  const v = record(input, "\u9884\u8BBE\u5B9A\u4E49");
  keys(v, ["id", "version", "hash", "title", "description", "preview", "elements", "controls"]);
  const ref = identity(v);
  if (!["geometric", "cinematic"].includes(String(v.preview))) return invalid("\u9884\u8BBE\u9884\u89C8\u7C7B\u578B\u65E0\u6548\u3002");
  if (!Array.isArray(v.elements) || !v.elements.length) return invalid("\u9884\u8BBE\u81F3\u5C11\u5305\u542B\u4E00\u4E2A\u5143\u7D20\u3002");
  const targets = /* @__PURE__ */ new Map();
  const templates = v.elements.map((input2) => {
    const e = record(input2, "\u9884\u8BBE\u5B50\u5143\u7D20");
    keys(e, ["key", "element", "name", "enabled", "bindings", "timing"], ["targets", "markerBindings"]);
    const key = name(e.key), element = validateResourceRef(e.element), definition = elements.find((d) => sameResource(d, element));
    if (!definition) return invalid("\u9884\u8BBE\u7F3A\u5C11\u7CBE\u786E\u7248\u672C\u7684\u5143\u7D20\u4F9D\u8D56\uFF1A" + resourceKey(element));
    if (targets.has(key) || typeof e.enabled !== "boolean") return invalid("\u9884\u8BBE\u5B50\u5143\u7D20 key \u6216\u542F\u7528\u72B6\u6001\u65E0\u6548\u3002");
    const bindings = validateElementBindings(e.bindings, definition.parameters);
    const markerBindings = validateMarkerBindings(
      e.markerBindings,
      definition.markerInputs,
      algorithms.find((a) => sameResource(a, definition.algorithm)).contract.timingInput,
      void 0,
      true
    );
    for (const [index, binding] of bindings.entries())
      if (binding.source.kind === "constant")
        assertDefaultPrecision(binding.source.value, definition.parameters[index]);
    targets.set(key, { definition, bindings });
    const t = record(e.timing, "\u9884\u8BBE\u65F6\u95F4");
    if (definition.kind === "transition") {
      keys(t, ["kind"]);
      if (t.kind !== "unbound") return invalid("\u9884\u8BBE\u8F6C\u573A\u987B\u5F85\u9009\u62E9\u8303\u56F4\u3002");
    } else {
      keys(t, ["kind", "start", "end"]);
      if (t.kind !== "relative" || finite(t.start, "start") < 0 || finite(t.end, "end") > 1 || Number(t.start) >= Number(t.end))
        return invalid("\u9884\u8BBE\u76F8\u5BF9\u65F6\u95F4\u65E0\u6548\u3002");
    }
    return {
      key,
      element,
      name: text(e.name, "\u5B50\u5143\u7D20\u540D\u79F0"),
      enabled: e.enabled,
      bindings,
      ...markerBindings ? { markerBindings } : {},
      timing: structuredClone(t),
      ...e.targets !== void 0 ? { targets: structuredClone(e.targets) } : {}
    };
  });
  for (const e of templates) {
    const definition = targets.get(e.key).definition;
    if (definition.kind === "visual") {
      if (e.targets !== void 0) return invalid("\u89C6\u89C9\u5143\u7D20\u4E0D\u80FD\u58F0\u660E\u6548\u679C\u76EE\u6807\u3002");
      continue;
    }
    const target = record(e.targets, "\u9884\u8BBE\u6548\u679C\u76EE\u6807");
    if (target.kind === "composition") keys(target, ["kind"]);
    else {
      keys(target, ["kind", "ids"]);
      if (target.kind !== "elements" || !Array.isArray(target.ids) || new Set(target.ids).size !== target.ids.length || target.ids.some((id) => targets.get(String(id))?.definition.kind !== "visual"))
        return invalid("\u9884\u8BBE\u5185\u90E8\u6548\u679C\u5F15\u7528\u65E0\u6548\u3002");
    }
  }
  const controls = validateCommonControls(v.controls, targets, algorithms);
  for (const control of controls)
    for (const key of control.targets) {
      const t = targets.get(key);
      if (canonicalJson(
        commonValue(
          control,
          t.bindings.find((b) => b.parameterId === control.parameterId),
          t.definition
        )
      ) !== canonicalJson(control.value))
        return invalid("\u9884\u8BBE\u5171\u540C\u503C\u4E0E\u9ED8\u8BA4\u5B50\u5143\u7D20\u914D\u7F6E\u4E0D\u4E00\u81F4\u3002");
    }
  const features = new Set(
    templates.flatMap((e) => e.bindings.flatMap((b) => b.source.kind === "analysis" ? [b.source.featureId] : []))
  );
  if (features.size > 4) return invalid("\u4E00\u4E2A\u9884\u8BBE\u6700\u591A\u4F7F\u7528\u56DB\u4E2A\u4E0D\u540C\u7684 Analyzer \u7279\u5F81\u3002");
  return {
    ...ref,
    title: text(v.title, "\u9884\u8BBE\u540D\u79F0"),
    description: text(v.description, "\u9884\u8BBE\u8BF4\u660E"),
    preview: v.preview,
    elements: templates,
    controls
  };
}
function validateResourceSnapshot(input, base = { algorithms: [], elements: [], presets: [] }) {
  const v = record(input, "\u8D44\u6E90\u5FEB\u7167");
  keys(v, ["algorithms", "elements", "presets"]);
  if (!Array.isArray(v.elements) || !Array.isArray(v.presets)) return invalid("\u8D44\u6E90\u5B9A\u4E49\u5FC5\u987B\u4E3A\u5217\u8868\u3002");
  if (!Array.isArray(v.algorithms)) return invalid("\u7B97\u6CD5\u5B9A\u4E49\u5FC5\u987B\u4E3A\u5217\u8868\u3002");
  const algorithms = v.algorithms.map(validateAlgorithmDefinition);
  const combined = mergeResources(base, { algorithms, elements: [], presets: [] });
  const elements = v.elements.map((e) => elementDefinition(e, combined.algorithms));
  const all = mergeResources(combined, { algorithms: [], elements, presets: [] });
  const presets = v.presets.map((p) => presetDefinition(p, all.elements, all.algorithms));
  mergeResources(all, { algorithms: [], elements: [], presets });
  return { algorithms, elements, presets };
}
function validateResourcePackage(input, base) {
  const v = record(input, "\u8D44\u6E90\u5305");
  keys(v, ["format", "schemaVersion", "id", "version", "algorithms", "elements", "presets"]);
  if (v.format !== "audiosurf-visualizer-resource" || v.schemaVersion !== 2)
    return invalid("\u8D44\u6E90\u5305\u683C\u5F0F\u6216\u7248\u672C\u4E0D\u652F\u6301\u3002");
  const snapshot = validateResourceSnapshot(
    { algorithms: v.algorithms, elements: v.elements, presets: v.presets },
    base
  );
  if (!snapshot.elements.length && !snapshot.presets.length) return invalid("\u8D44\u6E90\u5305\u4E0D\u80FD\u4E3A\u7A7A\u3002");
  return {
    format: "audiosurf-visualizer-resource",
    schemaVersion: 2,
    id: name(v.id),
    version: version(v.version),
    ...snapshot
  };
}
var decodeResourcePackage = (bytes, base) => validateResourcePackage(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)), base);
var resourceFileFormat = { extension: ".json", mimeType: "application/json" };
export {
  decodeResourcePackage,
  mergeResources,
  resourceFileFormat,
  validateResourcePackage,
  validateResourceRef,
  validateResourceSnapshot
};

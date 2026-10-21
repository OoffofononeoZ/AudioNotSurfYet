export function osuFixture(
    options: { mode?: number; timing?: string; objects?: string; bookmarks?: string; events?: string } = {},
): string {
    return `osu file format v14
[General]
AudioFilename: audio.wav
Mode: ${options.mode ?? 0}
[Metadata]
Title: Fixture
Artist: Composer
Creator: Mapper
Version: Test
[Difficulty]
CircleSize: 4
SliderMultiplier: 1.4
[Editor]
BeatDivisor: 4
Bookmarks: ${options.bookmarks ?? '500,2000'}
[Events]
${options.events ?? '2,3000,3500'}
[TimingPoints]
${options.timing ?? '-1000,500,4,1,0,100,1,0\n1000,-50,4,1,0,100,0,1\n2000,-100,4,1,0,100,0,0'}
[HitObjects]
${options.objects ?? '64,192,500,5,0,0:0:0:0:\n64,192,1100,6,0,L|204:192,2,140\n256,192,2000,12,0,2500,0:0:0:0:'}
`;
}

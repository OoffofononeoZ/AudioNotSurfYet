import { expect,it } from 'vitest';
import { assessEvents } from './qualityMetrics';
it('counts simultaneous events once per observation and retains signed timing, pitch and class errors',() => {
    const report = assessEvents([{category:'kick',startSeconds:1},{category:'hat',startSeconds:1},{category:'piano',pitch:60,startSeconds:2,endSeconds:3},{category:'guitar',pitch:55,startSeconds:4,endSeconds:5}],
        [{category:'hat',startSeconds:1.01},{category:'kick',startSeconds:.98},{category:'guitar',pitch:61,startSeconds:2.02,endSeconds:3.1},{category:'piano',pitch:70,startSeconds:6,endSeconds:7}]);
    expect(report).toMatchObject({matchedCount:3,missedCount:1,extraCount:1,classificationErrors:1,pitchErrors:1});expect(report.matches[2]?.startErrorSeconds).toBeCloseTo(.02);expect(report.matches[2]?.endErrorSeconds).toBeCloseTo(.1);
});
